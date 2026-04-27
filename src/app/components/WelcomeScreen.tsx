import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';

interface WelcomeScreenProps {
  /** First name shown after the brand. Falls back to "there" when blank. */
  name?: string;
  /** Triggered by the primary CTA. */
  onContinue?: () => void;
  /** Triggered by the secondary CTA. */
  onSkip?: () => void;
}

/**
 * First-run welcome screen for newly created staff.
 *
 * Apple-minimal aesthetic: a calm white/dark surface with a slow,
 * colorful aurora behind a single hero line. Each word fades up on a
 * stagger; the brand word "HugoIT" carries an animated multi-stop
 * gradient.
 */
export function WelcomeScreen({ name, onContinue, onSkip }: WelcomeScreenProps) {
  const display = (name || '').trim();
  // Words to stagger-animate. We treat "HugoIT" and the trailing name as
  // their own tokens so they can carry their own emphasis.
  const lead = ['Welcome', 'to'];
  const tail = display ? [`, ${display}`] : [];

  // Mount flag — turns on after first paint so the entry animation runs.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
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
        // Subtle inner vignette for depth.
        boxShadow: 'inset 0 0 200px rgba(0,0,0,0.25)',
      }}
    >
      {/* ── Animated aurora blobs ── */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <span className="hugo-blob hugo-blob-1" />
        <span className="hugo-blob hugo-blob-2" />
        <span className="hugo-blob hugo-blob-3" />
      </div>

      {/* ── Hero ── */}
      <div
        style={{
          position: 'relative',
          maxWidth: 720,
          width: '100%',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 28,
        }}
      >
        {/* Eyebrow */}
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
          <span className="hugo-dot" /> First time here
        </span>

        {/* Title — inline flow so the comma/name hugs the brand word. */}
        <h1
          id="welcome-title"
          style={{
            margin: 0,
            fontSize: 'clamp(40px, 7vw, 72px)',
            fontWeight: 700,
            letterSpacing: '-0.025em',
            lineHeight: 1.08,
            color: 'var(--text-primary)',
          }}
        >
          {lead.map((w, i) => (
            <span
              key={`l-${i}`}
              className="hugo-word"
              style={{ ['--d' as any]: `${120 + i * 90}ms`, opacity: mounted ? undefined : 0, marginRight: '0.28em' }}
            >
              {w}
            </span>
          ))}
          {/* Brand word — gradient applied to "HugoIT" only; the comma stays
              in normal color but in the same wrap-token so it never orphans. */}
          <span
            className="hugo-word"
            style={{ ['--d' as any]: `${120 + lead.length * 90}ms`, opacity: mounted ? undefined : 0, whiteSpace: 'nowrap' }}
          >
            <span className="hugo-brand-inline">HugoIT</span>
            {display && <span style={{ color: 'var(--text-primary)' }}>,</span>}
          </span>
          {display && (
            <span
              className="hugo-word"
              style={{
                ['--d' as any]: `${120 + (lead.length + 1) * 90}ms`,
                color: 'var(--text-primary)',
                opacity: mounted ? undefined : 0,
                marginLeft: '0.28em',
              }}
            >
              {display}
            </span>
          )}
        </h1>

        {/* Subtext */}
        <p
          className="hugo-fade"
          style={{
            ['--d' as any]: '700ms',
            margin: 0,
            maxWidth: 520,
            fontSize: 'clamp(15px, 1.6vw, 18px)',
            lineHeight: 1.55,
            color: 'var(--text-secondary)',
            opacity: mounted ? undefined : 0,
          }}
        >
          Let's set up and customize your profile so the clinic feels like yours
          from day one.
        </p>

        {/* CTAs */}
        <div
          className="hugo-fade"
          style={{
            ['--d' as any]: '900ms',
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
              cursor: 'pointer',
              boxShadow: '0 8px 24px -8px color-mix(in srgb, var(--brand-green-text) 60%, transparent)',
              transition: 'transform 0.15s ease, opacity 0.15s ease',
            }}
            className="hover:opacity-90 active:scale-[0.98]"
          >
            Continue to set up your profile
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
            Skip for now
          </button>
        </div>
      </div>

      {/* ── Local styles (kept inline so the component is drop-in) ── */}
      <style>{`
        @keyframes hugoWordIn {
          0%   { opacity: 0; transform: translate3d(0, 18px, 0); filter: blur(6px); }
          60%  { filter: blur(0); }
          100% { opacity: 1; transform: translate3d(0, 0, 0); filter: blur(0); }
        }
        @keyframes hugoFadeIn {
          0%   { opacity: 0; transform: translate3d(0, 8px, 0); }
          100% { opacity: 1; transform: translate3d(0, 0, 0); }
        }
        @keyframes hugoGradient {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes hugoBlobDrift {
          0%   { transform: translate3d(0, 0, 0)   scale(1);    }
          33%  { transform: translate3d(40px, -30px, 0) scale(1.08); }
          66%  { transform: translate3d(-30px, 40px, 0) scale(0.95); }
          100% { transform: translate3d(0, 0, 0)   scale(1);    }
        }
        @keyframes hugoDotPulse {
          0%, 100% { opacity: 1;   transform: scale(1);   }
          50%      { opacity: 0.4; transform: scale(0.6); }
        }

        .hugo-word {
          display: inline-block;
          animation: hugoWordIn 0.85s cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: var(--d, 0ms);
          will-change: opacity, transform, filter;
        }
        .hugo-fade {
          animation: hugoFadeIn 0.7s ease-out both;
          animation-delay: var(--d, 0ms);
          will-change: opacity, transform;
        }
        .hugo-brand,
        .hugo-brand-inline {
          background-image: linear-gradient(
            120deg,
            #6366F1 0%,
            #22D3EE 22%,
            #34D399 42%,
            #FACC15 62%,
            #F472B6 82%,
            #6366F1 100%
          );
          background-size: 220% 220%;
          background-clip: text;
          -webkit-background-clip: text;
          color: transparent;
          -webkit-text-fill-color: transparent;
          animation: hugoGradient 9s ease-in-out infinite;
        }
        .hugo-brand {
          animation: hugoWordIn 0.85s cubic-bezier(0.22, 1, 0.36, 1) both,
                     hugoGradient 9s ease-in-out infinite;
          animation-delay: var(--d, 0ms), 0ms;
        }
        .hugo-dot {
          width: 6px; height: 6px; border-radius: 9999px;
          background-color: var(--brand-green-text, #34D399);
          animation: hugoDotPulse 1.8s ease-in-out infinite;
        }
        .hugo-blob {
          position: absolute;
          width: 520px; height: 520px;
          border-radius: 9999px;
          filter: blur(90px);
          opacity: 0.55;
          mix-blend-mode: screen;
          animation: hugoBlobDrift 18s ease-in-out infinite;
        }
        .hugo-blob-1 {
          top: -180px; left: -120px;
          background: radial-gradient(circle at 30% 30%, #6366F1, transparent 60%);
        }
        .hugo-blob-2 {
          bottom: -200px; right: -160px;
          background: radial-gradient(circle at 70% 70%, #F472B6, transparent 60%);
          animation-delay: -6s;
        }
        .hugo-blob-3 {
          top: 35%; left: 40%;
          background: radial-gradient(circle at 50% 50%, #34D399, transparent 60%);
          animation-delay: -12s;
          opacity: 0.4;
        }
        @media (prefers-reduced-motion: reduce) {
          .hugo-word, .hugo-fade, .hugo-brand, .hugo-blob, .hugo-dot {
            animation: none !important;
          }
          .hugo-word, .hugo-fade { opacity: 1 !important; transform: none !important; filter: none !important; }
        }
      `}</style>
    </div>
  );
}

export default WelcomeScreen;
