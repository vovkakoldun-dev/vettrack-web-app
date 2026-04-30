import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useProfile, uploadAvatar, removeAvatar, type PortalType } from '../hooks/useProfile';
import { useTheme } from '../hooks/useTheme';
import { WelcomeScreen } from '../components/WelcomeScreen';
import { OnboardingPhotoStep } from '../components/OnboardingPhotoStep';
import { OnboardingAppearanceStep } from '../components/OnboardingAppearanceStep';

type Step = 'welcome' | 'photo' | 'appearance';

/**
 * First-run onboarding flow host. Works for both the doctor and admin
 * portals — the portal is derived from the URL so a single component
 * services both `/welcome` and `/admin/welcome`.
 *
 * Step 0: WelcomeScreen
 * Step 1: OnboardingPhotoStep (optional photo)
 * Step 2: OnboardingAppearanceStep (theme picker w/ live preview)
 *
 * The persisted "seen" flag is wired separately.
 */
export default function WelcomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = location.pathname.startsWith('/admin');
  const portal: PortalType = isAdmin ? 'admin' : 'doctor';
  const homePath = isAdmin ? '/admin' : '/';

  const { profile, loading } = useProfile(portal);
  const { setThemeStyle, selectedLightTheme, selectedDarkTheme } = useTheme();
  const [step, setStep] = useState<Step>('welcome');

  // Hold render until the profile fetch settles so the title doesn't flash
  // an email-derived fallback before the canonical name arrives.
  if (loading) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'var(--bg-offwhite, #0b0e14)',
        }}
      />
    );
  }

  const fromMeta = (user?.user_metadata?.first_name as string | undefined)?.trim();
  const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
  const fromEmail = user?.email ? user.email.split('@')[0].split('.')[0] : '';
  const firstName = profile.firstName || fromMeta || cap(fromEmail);
  const initials = profile.initials || (firstName ? firstName.slice(0, 2).toUpperCase() : 'YOU');

  /** End the wizard, request the tour to start, and land on the dashboard. */
  const finish = () => {
    try { sessionStorage.setItem('vettrack-tour-pending', portal); } catch {}
    navigate(homePath);
    // The shell's tour listener mounts before this fires; broadcasting a
    // custom event lets it activate without an unmount/remount cycle.
    window.dispatchEvent(new CustomEvent('vettrack:start-tour', { detail: portal }));
  };

  if (step === 'welcome') {
    return (
      <WelcomeScreen
        name={firstName}
        onContinue={() => setStep('photo')}
        onSkip={finish}
      />
    );
  }

  if (step === 'photo') {
    return (
      <OnboardingPhotoStep
        avatarUrl={profile.avatarUrl}
        initials={initials}
        onUpload={async (file) => {
          if (!profile.id) throw new Error('Profile not loaded');
          return uploadAvatar(profile.id, file, portal);
        }}
        onRemove={profile.avatarUrl
          ? async () => {
              if (!profile.id) throw new Error('Profile not loaded');
              await removeAvatar(profile.id, portal);
            }
          : undefined}
        onBack={() => setStep('welcome')}
        onContinue={() => setStep('appearance')}
        onSkip={() => setStep('appearance')}
      />
    );
  }

  return (
    <OnboardingAppearanceStep
      selectedLight={selectedLightTheme}
      selectedDark={selectedDarkTheme}
      onSelect={setThemeStyle}
      onBack={() => setStep('photo')}
      onContinue={finish}
    />
  );
}
