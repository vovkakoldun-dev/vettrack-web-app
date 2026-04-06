import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { getOrgContext } from './useOrgContext'
import { useTenantDb } from '../context/TenantContext'

export interface ClientPet {
  id: string
  name: string
  species: string
  breed: string | null
  photo_url: string | null
  assigned_vet_id: string | null
  assigned_vet: { id: string; profiles: { first_name: string; last_name: string } | null } | null
}

export interface ClientRow {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  country: string | null
  notes: string | null
  portal_status: string | null
  health_status: string | null
  created_at: string
  pets?: ClientPet[]
}

export interface AddClientValues {
  first_name: string
  last_name: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  country?: string
  notes?: string
}

// ─── Standalone cascade-delete helpers (no hooks) ─────────────

/** Delete all data for a single pet across every table + storage */
export async function deletePetCascade(petId: string) {
  // 1. Delete pet-dependent records (deepest first)
  await Promise.all([
    supabase.from('pet_weight_history').delete().eq('pet_id', petId),
    supabase.from('lab_results').delete().eq('pet_id', petId),
    supabase.from('medications').delete().eq('pet_id', petId),
    supabase.from('vaccinations').delete().eq('pet_id', petId),
    supabase.from('pet_allergies').delete().eq('pet_id', petId),
    supabase.from('pet_conditions').delete().eq('pet_id', petId),
    supabase.from('pet_treatments').delete().eq('pet_id', petId),
    supabase.from('pet_notes').delete().eq('pet_id', petId),
  ])

  // 2. Delete shared-FK records (appointments, medical_records, tasks)
  await Promise.all([
    supabase.from('appointments').delete().eq('pet_id', petId),
    supabase.from('medical_records').delete().eq('pet_id', petId),
    supabase.from('tasks').delete().eq('pet_id', petId),
  ])

  // 3. Delete photos from storage (try both buckets)
  try {
    const { data: files1 } = await supabase.storage.from('pet-photos').list(petId)
    if (files1 && files1.length > 0) {
      await supabase.storage.from('pet-photos').remove(files1.map(f => `${petId}/${f.name}`))
    }
    const { data: files2 } = await supabase.storage.from('pet-images').list(petId)
    if (files2 && files2.length > 0) {
      await supabase.storage.from('pet-images').remove(files2.map(f => `${petId}/${f.name}`))
    }
  } catch {}

  // 4. Delete the pet itself
  await supabase.from('pets').delete().eq('id', petId)
}

// ─── Hook ─────────────────────────────────────────────────────

export function useClients() {
  const db = useTenantDb()
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchClients = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { organizationId } = await getOrgContext()
      const { data, error: err } = await db
        .from('clients')
        .select('id, first_name, last_name, email, phone, address, city, state, zip, country, notes, portal_status, health_status, created_at, pets(id, name, species, breed, photo_url, assigned_vet_id, assigned_vet:staff!pets_assigned_vet_org_fkey(id, profiles:profiles!staff_profile_org_fkey(first_name, last_name)))')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
      if (err) {
        setError(err.message)
      } else {
        setClients((data as ClientRow[]) ?? [])
      }
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  // Listen for cross-page data changes — debounced to prevent cascade storms
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const handler = () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
      refetchTimerRef.current = setTimeout(() => fetchClients(), 300);
    }
    window.addEventListener('clientDataChanged', handler)
    window.addEventListener('petDataChanged', handler)
    return () => {
      window.removeEventListener('clientDataChanged', handler)
      window.removeEventListener('petDataChanged', handler)
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    }
  }, [fetchClients])

  const addClient = useCallback(async (values: AddClientValues) => {
    const { organizationId } = await getOrgContext();
    const { data, error: err } = await db
      .from('clients')
      .insert([{ organization_id: organizationId, ...values }])
      .select('id, first_name, last_name, email, phone, address, city, state, zip, country, notes, portal_status, health_status, created_at, pets(id, name, species, breed, photo_url, assigned_vet_id, assigned_vet:staff!pets_assigned_vet_org_fkey(id, profiles:profiles!staff_profile_org_fkey(first_name, last_name)))')
      .single()
    if (!err && data) {
      setClients(prev => [data as ClientRow, ...prev])
      window.dispatchEvent(new CustomEvent('clientDataChanged'))
    }
    return { data, error: err }
  }, [])

  const updateClient = useCallback(async (id: string, values: Partial<AddClientValues>) => {
    const { organizationId } = await getOrgContext()
    const { data, error: err } = await db
      .from('clients')
      .update(values)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single()
    if (!err && data) {
      setClients(prev => prev.map(c => c.id === id ? { ...c, ...values } : c))
      window.dispatchEvent(new CustomEvent('clientDataChanged'))
    }
    return { data, error: err }
  }, [])

  const deleteClient = useCallback(async (id: string) => {
    const { organizationId } = await getOrgContext()

    // 1. Get all pet IDs for this client
    const { data: pets } = await db
      .from('pets')
      .select('id')
      .eq('client_id', id)
      .eq('organization_id', organizationId)

    // 2. Cascade-delete every pet (parallel for speed)
    if (pets && pets.length > 0) {
      await Promise.all(pets.map(pet => deletePetCascade(pet.id)))
    }

    // 3. Delete client-only FK records
    await Promise.all([
      db.from('invoices').delete().eq('client_id', id),
      db.from('staff_ratings').delete().eq('client_id', id),
      db.from('appointments').delete().eq('client_id', id),
      db.from('medical_records').delete().eq('client_id', id),
      db.from('tasks').delete().eq('client_id', id),
    ])

    // 4. Delete the client
    const { error: err } = await db.from('clients').delete().eq('id', id).eq('organization_id', organizationId)
    if (!err) {
      setClients(prev => prev.filter(c => c.id !== id))
      window.dispatchEvent(new CustomEvent('clientDataChanged'))
    }
    return { error: err }
  }, [])

  return { clients, loading, error, refetch: fetchClients, addClient, updateClient, deleteClient }
}
