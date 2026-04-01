import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

// ─── Role groups ──────────────────────────────────────────────
export const DOCTOR_ROLES = ['veterinarian', 'senior_veterinarian', 'lead_vet_tech', 'specialist'] as const;
export const ADMIN_ROLES  = ['front_desk_manager', 'receptionist', 'clinic_manager', 'superadmin'] as const;

export type PortalType = 'doctor' | 'admin';

// ─── Profile shape ────────────────────────────────────────────
export interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;       // "Dr. Volodymyr Koldun" or "Joey Mitchell"
  displayName: string;    // "Dr. Koldun" (doctor) or "Joey Mitchell" (admin)
  initials: string;       // "VK"
  email: string;
  phone: string;
  avatarUrl: string;
  role: string;
  organizationId: string;
}

const EMPTY_PROFILE: Profile = {
  id: '',
  firstName: '',
  lastName: '',
  fullName: '',
  displayName: '',
  initials: '',
  email: '',
  phone: '',
  avatarUrl: '',
  role: '',
  organizationId: '',
};

function buildProfile(data: any, portal: PortalType): Profile {
  const firstName = data.first_name || '';
  const lastName = data.last_name || '';
  const isDoctor = (data.role === 'doctor' || data.role === 'veterinarian');
  const fullName = isDoctor
    ? `Dr. ${firstName} ${lastName}`.trim()
    : `${firstName} ${lastName}`.trim();
  const displayName = isDoctor
    ? `Dr. ${lastName}`.trim()
    : `${firstName} ${lastName}`.trim();
  const initials = [firstName, lastName]
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return {
    id: data.id,
    firstName,
    lastName,
    fullName,
    displayName,
    initials,
    email: data.email || '',
    phone: data.phone || '',
    avatarUrl: data.avatar_url || '',
    role: data.role || '',
    organizationId: data.organization_id || '',
  };
}

// ─── Singleton cache per portal ───────────────────────────────
// Prevents every component from doing its own fetch.
const cache: Record<string, { profile: Profile; timestamp: number }> = {};
const CACHE_TTL = 30_000; // 30 seconds

/** Clear all cached profile data (call on sign-out) */
export function clearProfileCache() {
  for (const key of Object.keys(cache)) {
    delete cache[key];
  }
}

// ─── Hook ─────────────────────────────────────────────────────
export function useProfile(portal: PortalType) {
  const roles = portal === 'doctor' ? DOCTOR_ROLES : ADMIN_ROLES;
  const cacheKey = portal;

  const [profile, setProfile] = useState<Profile>(() => {
    const cached = cache[cacheKey];
    return cached ? cached.profile : EMPTY_PROFILE;
  });
  const [loading, setLoading] = useState(!cache[cacheKey]);

  const fetchProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, phone, avatar_url, role, organization_id')
      .eq('id', user.id)
      .single();

    if (data) {
      const p = buildProfile(data, portal);
      cache[cacheKey] = { profile: p, timestamp: Date.now() };
      setProfile(p);
    }
    setLoading(false);
  }, [portal, cacheKey]);

  // Fetch on mount (skip if cache is fresh)
  useEffect(() => {
    const cached = cache[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setProfile(cached.profile);
      setLoading(false);
      // Still refetch in background for freshness
      fetchProfile();
      return;
    }
    fetchProfile();
  }, [fetchProfile, cacheKey]);

  // ── Listen for profile changes from settings pages ──────────
  useEffect(() => {
    const handleProfileChanged = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (!d) return;
      setProfile(prev => {
        const updated = {
          ...prev,
          firstName: d.firstName ?? prev.firstName,
          lastName: d.lastName ?? prev.lastName,
          email: d.email ?? prev.email,
          phone: d.phone ?? prev.phone,
          fullName: (prev.role === 'doctor' || prev.role === 'veterinarian')
            ? `Dr. ${d.firstName ?? prev.firstName} ${d.lastName ?? prev.lastName}`.trim()
            : `${d.firstName ?? prev.firstName} ${d.lastName ?? prev.lastName}`.trim(),
          displayName: (prev.role === 'doctor' || prev.role === 'veterinarian')
            ? `Dr. ${d.lastName ?? prev.lastName}`.trim()
            : `${d.firstName ?? prev.firstName} ${d.lastName ?? prev.lastName}`.trim(),
          initials: [d.firstName ?? prev.firstName, d.lastName ?? prev.lastName]
            .filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2),
        };
        cache[cacheKey] = { profile: updated, timestamp: Date.now() };
        return updated;
      });
    };

    const handlePhotoChanged = (e: Event) => {
      const d = (e as CustomEvent).detail;
      const url = d?.photo_url ?? d?.avatar_url ?? '';
      setProfile(prev => {
        const updated = { ...prev, avatarUrl: url };
        cache[cacheKey] = { profile: updated, timestamp: Date.now() };
        return updated;
      });
    };

    const profileEvent = portal === 'doctor' ? 'doctorProfileChanged' : 'adminProfileChanged';
    const photoEvent = portal === 'doctor' ? 'staffPhotoChanged' : 'adminPhotoChanged';

    window.addEventListener(profileEvent, handleProfileChanged);
    window.addEventListener(photoEvent, handlePhotoChanged);
    return () => {
      window.removeEventListener(profileEvent, handleProfileChanged);
      window.removeEventListener(photoEvent, handlePhotoChanged);
    };
  }, [portal, cacheKey]);

  return { profile, loading, refetch: fetchProfile };
}

// ─── Update helpers ───────────────────────────────────────────
// All profile writes go through these functions → profiles table only.

export async function updateProfile(
  profileId: string,
  fields: Partial<{ first_name: string; last_name: string; email: string; phone: string }>,
) {
  const { error } = await supabase
    .from('profiles')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', profileId);
  return { error };
}

export async function updateProfileAvatar(profileId: string, avatarUrl: string | null) {
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq('id', profileId);
  return { error };
}

// ─── Avatar upload (centralised) ──────────────────────────────
// Bucket: "avatars" (public). File: "user-{profileId}.png" (upsert).
const AVATAR_BUCKET = 'avatars';

function avatarPath(profileId: string): string {
  return `user-${profileId}.png`;
}

/**
 * Upload a profile avatar image.
 * • Stores in `avatars` bucket as `user-{id}.png` (upsert = no duplicates).
 * • Saves public URL to `profiles.avatar_url`.
 * • Dispatches custom event so all UI updates instantly.
 * @returns The public URL on success, or throws on error.
 */
export async function uploadAvatar(
  profileId: string,
  file: File,
  portal: PortalType,
): Promise<string> {
  const path = avatarPath(profileId);

  // 1) Upload with upsert — old image replaced automatically
  const { error: uploadErr } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadErr) throw new Error('Upload failed: ' + uploadErr.message);

  // 2) Get public URL with cache-bust param
  const { data: urlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const publicUrl = urlData.publicUrl + '?t=' + Date.now();

  // 3) Save URL to profiles table
  await updateProfileAvatar(profileId, publicUrl);

  // 4) Dispatch event for instant UI update across all components
  const photoEvent = portal === 'doctor' ? 'staffPhotoChanged' : 'adminPhotoChanged';
  window.dispatchEvent(new CustomEvent(photoEvent, { detail: { photo_url: publicUrl, avatar_url: publicUrl } }));

  return publicUrl;
}

/**
 * Remove the profile avatar.
 * • Deletes file from `avatars` bucket.
 * • Sets `profiles.avatar_url` to null.
 * • Dispatches custom event so UI clears instantly.
 */
export async function removeAvatar(
  profileId: string,
  portal: PortalType,
): Promise<void> {
  const path = avatarPath(profileId);

  // 1) Delete from storage (best-effort)
  await supabase.storage.from(AVATAR_BUCKET).remove([path]);

  // 2) Clear URL in profiles table
  await updateProfileAvatar(profileId, null);

  // 3) Dispatch event for instant UI update
  const photoEvent = portal === 'doctor' ? 'staffPhotoChanged' : 'adminPhotoChanged';
  window.dispatchEvent(new CustomEvent(photoEvent, { detail: { photo_url: '', avatar_url: '' } }));
}
