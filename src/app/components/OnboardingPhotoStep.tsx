import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Camera, Loader2, Trash2 } from 'lucide-react';

interface OnboardingPhotoStepProps {
  /** First name shown in the heading. */
  name?: string;
  /** Existing avatar URL (if the user already has one). */
  avatarUrl?: string;
  /** Initials shown when there is no photo yet. */
  initials?: string;
  /** Asked to upload — should write the file and return the new public URL. */
  onUpload?: (file: File) => Promise<string>;
  /** Optional removal handler. Hidden when omitted. */
  onRemove?: () => Promise<void>;
  /** Triggered by the primary CTA. */
  onContinue?: () => void;
  /** Triggered by the secondary CTA ("I'll do this later"). */
  onSkip?: () => void;
  /** Triggered by the "Back" arrow. Hidden when omitted. */
  onBack?: () => void;
}

/**
 * Step 2 of the first-run flow: optional profile photo.
 *
 * Apple-minimal aesthetic: soft aurora behind a single hero card.
 * Photo is explicitly optional; the helper text reminds the user
 * it can be changed any time from Settings.
 */
export function OnboardingPhotoStep({
  name,
  avatarUrl,
  initials,
  onUpload,
  onRemove,
  onContinue,
  onSkip,
  onBack,
}: OnboardingPhotoStepProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string>(avatarUrl || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Keep the preview in sync if the parent's URL changes after a refetch.
  useEffect(() => { setPreview(avatarUrl || ''); }, [avatarUrl]);

  const pickFile = () => {
    setErr(null);
    fileInputRef.current?.click();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErr('Please choose an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr('Image must be under 5 MB.');
      return;
    }

    // Optimistic local preview while the upload runs.
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    if (!onUpload) return;
    try {
      setBusy(true);
      const url = await onUpload(file);
      if (url) setPreview(url);
    } catch (e: any) {
      setErr(e?.message || 'Upload failed. Please try again.');
      setPreview(avatarUrl || '');
    } finally {
      setBusy(false);
      // Clear so the same file can be picked again.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const remove = async () => {
    if (!onRemove) return;
    try {
      setBusy(true);
      await onRemove();
      setPreview('');
    } catch (e: any) {
      setErr(e?.message || 'Remove failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-photo-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        backgroundColor: 'var(--bg-offwhite, #0b0e14)',
        color: 'var(--text-primary)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        boxShadow: 'inset 0 0 200px rgba(0,0,0,0.25)',
      }}
    >
      {/* Aurora — same family as the welcome screen but rotated. */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <span className="hugo-blob hugo-blob-1" />
        <span className="hugo-blob hugo-blob-2" />
        <span className="hugo-blob hugo-blob-3" />
      </div>

      {/* Hero */}
      <div
        style={{
          position: 'relative',
          maxWidth: 560,
          width: '100%',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 22,
        }}
      >
        {/* Step pill */}
        <span
          className="hugo-fade"
          style={{
            ['--d' as any]: '40ms',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            borderRadius: 9999,
            backgroundColor: 'color-mix(in srgb, var(--text-primary) 6%, transparent)',
            border: '1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            opacity: mounted ? undefined : 0,
          }}
        >
          Step 2 of 3 · Optional
        </span>

        {/* Title */}
        <h1
          id="onboarding-photo-title"
          className="hugo-fade"
          style={{
            ['--d' as any]: '160ms',
            margin: 0,
            fontSize: 'clamp(32px, 5.2vw, 52px)',
            fontWeight: 700,
            letterSpacing: '-0.022em',
            lineHeight: 1.1,
            opacity: mounted ? undefined : 0,
          }}
        >
          Add a photo{name ? `, ${name}` : ''}
        </h1>

        {/* Subtext */}
        <p
          className="hugo-fade"
          style={{
            ['--d' as any]: '260ms',
            margin: 0,
            maxWidth: 460,
            fontSize: 'clamp(14px, 1.5vw, 16px)',
            lineHeight: 1.55,
            color: 'var(--text-secondary)',
            opacity: mounted ? undefined : 0,
          }}
        >
          A friendly face helps clients and teammates recognize you. This is
          completely optional — you can add or change it any time from{' '}
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Settings</span>.
        </p>

        {/* Avatar */}
        <button
          type="button"
          onClick={pickFile}
          disabled={busy}
          aria-label={preview ? 'Change profile photo' : 'Upload profile photo'}
          className="hugo-fade hugo-avatar"
          style={{
            ['--d' as any]: '360ms',
            position: 'relative',
            width: 'min(40vw, 168px)',
            height: 'min(40vw, 168px)',
            borderRadius: 9999,
            border: 'none',
            padding: 0,
            cursor: busy ? 'wait' : 'pointer',
            backgroundColor: 'color-mix(in srgb, var(--text-primary) 6%, transparent)',
            boxShadow:
              '0 24px 48px -16px color-mix(in srgb, var(--brand-green-text) 35%, transparent), 0 0 0 1px color-mix(in srgb, var(--text-primary) 10%, transparent) inset',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: mounted ? undefined : 0,
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
        >
          {preview ? (
            <img
              src={preview}
              alt="Profile preview"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span
              style={{
                fontSize: 'clamp(36px, 6vw, 60px)',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                letterSpacing: '-0.02em',
              }}
            >
              {(initials || (name ? name.slice(0, 2).toUpperCase() : 'YOU'))}
            </span>
          )}

          {/* Subtle busy overlay while an upload is in flight. */}
          {busy && (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'color-mix(in srgb, var(--bg-offwhite, #0b0e14) 55%, transparent)',
              }}
            >
              <Loader2 style={{ width: 22, height: 22, color: 'var(--text-primary)' }} className="animate-spin" />
            </span>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onFile}
            style={{ display: 'none' }}
          />
        </button>

        {/* Helper actions under the avatar */}
        <div
          className="hugo-fade"
          style={{
            ['--d' as any]: '440ms',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            opacity: mounted ? undefined : 0,
          }}
        >
          <button
            type="button"
            onClick={pickFile}
            disabled={busy}
            style={{
              padding: '8px 16px',
              borderRadius: 9999,
              border: '1px solid color-mix(in srgb, var(--text-primary) 14%, transparent)',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: busy ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Camera style={{ width: 13, height: 13 }} />
            {preview ? 'Change photo' : 'Upload photo'}
          </button>
          {preview && onRemove && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              style={{
                padding: '8px 14px',
                borderRadius: 9999,
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 600,
                cursor: busy ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
              className="hover:!text-red-500"
            >
              <Trash2 style={{ width: 13, height: 13 }} />
              Remove
            </button>
          )}
        </div>

        {err && (
          <p style={{ margin: 0, fontSize: 13, color: '#ef4444' }}>{err}</p>
        )}

        {/* CTAs */}
        <div
          className="hugo-fade"
          style={{
            ['--d' as any]: '560ms',
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            justifyContent: 'center',
            marginTop: 4,
            opacity: mounted ? undefined : 0,
          }}
        >
          <button
            type="button"
            onClick={onContinue}
            disabled={busy}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 22px',
              borderRadius: 9999,
              border: 'none',
              backgroundColor: 'var(--brand-green-text)',
              color: 'var(--on-brand-green, #ffffff)',
              fontSize: 14,
              fontWeight: 700,
              cursor: busy ? 'wait' : 'pointer',
              boxShadow: '0 8px 24px -8px color-mix(in srgb, var(--brand-green-text) 60%, transparent)',
              transition: 'transform 0.15s ease, opacity 0.15s ease',
            }}
            className="hover:opacity-90 active:scale-[0.98]"
          >
            Continue
            <ArrowRight style={{ width: 14, height: 14 }} />
          </button>
          <button
            type="button"
            onClick={onSkip}
            style={{
              padding: '12px 18px',
              borderRadius: 9999,
              border: '1px solid color-mix(in srgb, var(--text-primary) 14%, transparent)',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease, color 0.15s ease',
            }}
            className="hover:!text-[var(--text-primary)] hover:!bg-[color-mix(in_srgb,var(--text-primary)_5%,transparent)]"
          >
            I'll do this later
          </button>
        </div>

        {/* Footer reassurance */}
        <p
          className="hugo-fade"
          style={{
            ['--d' as any]: '680ms',
            margin: '8px 0 0',
            fontSize: 12,
            color: 'var(--text-secondary)',
            opacity: mounted ? undefined : 0,
          }}
        >
          You can update this anytime from Settings → Profile.
        </p>
      </div>

      {/* Back chevron — top-left when provided */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          style={{
            position: 'absolute',
            top: 18,
            left: 18,
            width: 36,
            height: 36,
            borderRadius: 9999,
            border: '1px solid color-mix(in srgb, var(--text-primary) 14%, transparent)',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          className="hover:!text-[var(--text-primary)] hover:!bg-[color-mix(in_srgb,var(--text-primary)_5%,transparent)]"
        >
          <ArrowRight style={{ width: 16, height: 16, transform: 'rotate(180deg)' }} />
        </button>
      )}

      {/* Local styles — share keyframes with WelcomeScreen via duplication so
          this component stays drop-in. */}
      <style>{`
        @keyframes hugoFadeIn {
          0%   { opacity: 0; transform: translate3d(0, 8px, 0); }
          100% { opacity: 1; transform: translate3d(0, 0, 0); }
        }
        @keyframes hugoBlobDrift {
          0%   { transform: translate3d(0, 0, 0)   scale(1);    }
          33%  { transform: translate3d(40px, -30px, 0) scale(1.08); }
          66%  { transform: translate3d(-30px, 40px, 0) scale(0.95); }
          100% { transform: translate3d(0, 0, 0)   scale(1);    }
        }
        .hugo-fade {
          animation: hugoFadeIn 0.7s ease-out both;
          animation-delay: var(--d, 0ms);
          will-change: opacity, transform;
        }
        .hugo-avatar:hover { transform: translateY(-1px); }
        .hugo-blob {
          position: absolute;
          width: 520px; height: 520px;
          border-radius: 9999px;
          filter: blur(90px);
          opacity: 0.5;
          mix-blend-mode: screen;
          animation: hugoBlobDrift 18s ease-in-out infinite;
        }
        .hugo-blob-1 {
          top: -180px; right: -120px;
          background: radial-gradient(circle at 30% 30%, #6366F1, transparent 60%);
        }
        .hugo-blob-2 {
          bottom: -200px; left: -160px;
          background: radial-gradient(circle at 70% 70%, #F472B6, transparent 60%);
          animation-delay: -6s;
        }
        .hugo-blob-3 {
          top: 35%; left: 30%;
          background: radial-gradient(circle at 50% 50%, #34D399, transparent 60%);
          animation-delay: -12s;
          opacity: 0.35;
        }
        @media (prefers-reduced-motion: reduce) {
          .hugo-fade, .hugo-blob, .hugo-avatar { animation: none !important; }
          .hugo-fade { opacity: 1 !important; transform: none !important; }
        }
      `}</style>
    </div>
  );
}

export default OnboardingPhotoStep;
