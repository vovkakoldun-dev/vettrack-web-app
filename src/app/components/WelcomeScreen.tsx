import { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';

/** Pre-computed star field — once per mount, deterministic per session.
 *  Each star carries a position, size, base opacity, and a twinkle phase
 *  so the whole sky looks alive and never identical. */
function useStarField(count = 90) {
  return useMemo(() => {
    const stars: {
      top: number; left: number;
      size: number; opacity: number;
      delay: number; duration: number;
    }[] = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        top:     Math.random() * 100,
        left:    Math.random() * 100,
        size:    Math.random() * 2 + 1,                 // 1–3 px
        opacity: Math.random() * 0.55 + 0.35,            // 0.35–0.90
        delay:   Math.random() * -6,                     // negative → mid-loop on mount
        duration: Math.random() * 3 + 2.6,               // 2.6–5.6 s twinkle period
      });
    }
    return stars;
  }, [count]);
}

/** Brief shooting-star flashes. Each one is a glowing head with a
 *  trailing tail. Spawn position, angle, and travel distance are
 *  randomised per shooter so they don't all look like clones. */
const SHOOTERS: {
  top: number; left: number;
  delay: number; duration: number;
  /** End-point delta in pixels — defines the streak's length & angle. */
  dx: number; dy: number;
}[] = [
  { top: 14, left: 14, delay: 1.5,  duration: 8,  dx: 380, dy: 120 },
  { top: 28, left: 60, delay: 5.0,  duration: 10, dx: 460, dy: 90  },
  { top: 52, left: 24, delay: 9.5,  duration: 9,  dx: 320, dy: 150 },
  { top: 18, left: 80, delay: 14.0, duration: 11, dx: 300, dy: 70  },
  { top: 64, left: 66, delay: 19.0, duration: 10, dx: 420, dy: 110 },
];

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

  const stars = useStarField(90);

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
      {/* ── Animated star field — sits behind the aurora blobs ── */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {stars.map((s, i) => (
          <span
            key={i}
            className="hugo-star"
            style={{
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: s.size,
              height: s.size,
              ['--o' as any]: s.opacity,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.duration}s`,
            }}
          />
        ))}
        {SHOOTERS.map((sh, i) => {
          // Angle of the streak in degrees (slope of dy/dx).
          const angle = Math.atan2(sh.dy, sh.dx) * (180 / Math.PI);
          return (
            <span
              key={`shoot-${i}`}
              className="hugo-shooter"
              style={{
                top: `${sh.top}%`,
                left: `${sh.left}%`,
                ['--dx' as any]: `${sh.dx}px`,
                ['--dy' as any]: `${sh.dy}px`,
                ['--angle' as any]: `${angle}deg`,
                animationDelay: `${sh.delay}s`,
                animationDuration: `${sh.duration}s`,
              }}
            />
          );
        })}
      </div>

      {/* ── Animated aurora blobs ── */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <span className="hugo-blob hugo-blob-1" />
        <span className="hugo-blob hugo-blob-2" />
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

        /* ── Star field ─────────────────────────────────────── */
        @keyframes hugoStarTwinkle {
          0%, 100% { opacity: calc(var(--o, 0.6) * 0.25); transform: scale(0.85); }
          50%      { opacity: var(--o, 0.6);              transform: scale(1.15); }
        }
        .hugo-star {
          position: absolute;
          border-radius: 9999px;
          background: #ffffff;
          box-shadow:
            0 0 4px rgba(255,255,255,0.65),
            0 0 8px rgba(180, 200, 255, 0.35);
          animation: hugoStarTwinkle linear infinite;
          will-change: opacity, transform;
        }

        /* ── Shooting stars (meteors) ─────────────────────────
           A meteor is built from two parts:
            • the .hugo-shooter element itself = the bright head (a small
              glowing dot with a multi-layer drop-shadow halo)
            • its ::before = the tail (a long gradient that extends back
              from the head along the motion angle)
           A single keyframe handles position + opacity. The wrapper
           rotates by --angle so the tail aligns to the motion path; the
           translate moves the whole thing from origin to (dx, dy). The
           tail is positioned with right:100% so it sits behind the head,
           scaling from 0 to full length as the meteor accelerates. */
        @keyframes hugoShoot {
          /* Long invisible idle — most of the cycle. */
          0%, 78% {
            opacity: 0;
            transform: translate3d(0, 0, 0) rotate(var(--angle, 14deg));
          }
          /* Ignite at the spawn point — head bright, tail still 0. */
          81% {
            opacity: 1;
            transform: translate3d(0, 0, 0) rotate(var(--angle, 14deg));
          }
          /* Streak across — keep full opacity through the burn. */
          92% {
            opacity: 1;
            transform: translate3d(var(--dx, 380px), var(--dy, 120px), 0) rotate(var(--angle, 14deg));
          }
          /* Burn out — fade to zero in the last sliver of the path. */
          96% {
            opacity: 0;
            transform: translate3d(var(--dx, 380px), var(--dy, 120px), 0) rotate(var(--angle, 14deg));
          }
          100% {
            opacity: 0;
            transform: translate3d(var(--dx, 380px), var(--dy, 120px), 0) rotate(var(--angle, 14deg));
          }
        }
        @keyframes hugoShootTail {
          0%, 80% { width: 0; opacity: 0; }
          82%     { width: 0; opacity: 1; }
          90%     { width: 180px; opacity: 1; }
          96%     { width: 220px; opacity: 0; }
          100%    { width: 220px; opacity: 0; }
        }

        .hugo-shooter {
          /* The HEAD — a small bright glowing dot. */
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 9999px;
          background: #ffffff;
          /* Layered halo: tight white core, soft cyan-white mid, blue
             outer glow — reads as plasma/heat. */
          box-shadow:
            0 0 4px  rgba(255, 255, 255, 1),
            0 0 12px rgba(200, 220, 255, 0.85),
            0 0 24px rgba(140, 165, 255, 0.55),
            0 0 40px rgba(99,  102, 241, 0.30);
          opacity: 0;
          animation: hugoShoot cubic-bezier(0.2, 0.6, 0.3, 1) infinite;
          will-change: opacity, transform;
          transform: rotate(var(--angle, 14deg));
        }
        .hugo-shooter::before {
          /* The TAIL — gradient line trailing behind the head. */
          content: '';
          position: absolute;
          right: 100%;
          top: 50%;
          height: 1.5px;
          width: 0;
          transform: translateY(-50%);
          border-radius: 9999px;
          background: linear-gradient(
            to left,
            rgba(255, 255, 255, 0.95) 0%,
            rgba(200, 220, 255, 0.55) 30%,
            rgba(140, 165, 255, 0.18) 70%,
            transparent 100%
          );
          filter: blur(0.4px);
          /* Tiny shadow gives the tail a faint atmospheric haze. */
          box-shadow: 0 0 6px rgba(180, 200, 255, 0.5);
          animation: hugoShootTail cubic-bezier(0.2, 0.6, 0.3, 1) infinite;
          animation-duration: inherit;
          animation-delay: inherit;
        }

        @media (prefers-reduced-motion: reduce) {
          .hugo-word, .hugo-fade, .hugo-brand, .hugo-blob, .hugo-dot,
          .hugo-star, .hugo-shooter {
            animation: none !important;
          }
          .hugo-shooter { display: none; }
          .hugo-star { opacity: var(--o, 0.6) !important; transform: none !important; }
          .hugo-word, .hugo-fade { opacity: 1 !important; transform: none !important; filter: none !important; }
        }
      `}</style>
    </div>
  );
}

export default WelcomeScreen;
