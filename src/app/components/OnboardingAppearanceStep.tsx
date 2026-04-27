import { useEffect, useState } from 'react';
import { ArrowRight, Check, Moon, Sparkles, Sun } from 'lucide-react';
import {
  THEME_STYLES,
  LIGHT_THEMES,
  DARK_THEMES,
  type ThemeStyle,
} from '../hooks/useTheme';

/** Themes flagged as the suggested defaults — get a "Recommended" ribbon. */
const RECOMMENDED_THEMES: ReadonlySet<ThemeStyle> = new Set(['contrast']);

interface OnboardingAppearanceStepProps {
  /** Currently saved light-mode pick — highlighted in the Light row. */
  selectedLight?: ThemeStyle;
  /** Currently saved dark-mode pick — highlighted in the Dark row. */
  selectedDark?: ThemeStyle;
  /** Called whenever the user picks a tile. Apply the theme live. */
  onSelect?: (style: ThemeStyle) => void;
  /** Primary CTA. */
  onContinue?: () => void;
  /** Top-left back arrow. Hidden when omitted. */
  onBack?: () => void;
  /** Friendly name to greet, e.g. for the heading. */
  name?: string;
}

/**
 * Tiny color tokens used to render each tile's preview UI. These are
 * approximations of the real theme tokens — accurate enough that a
 * thumbnail conveys the look without re-applying the theme to a portal.
 */
const PREVIEW: Record<ThemeStyle, {
  bg: string;
  surface: string;
  sidebar: string;
  accent: string;
  text: string;
  muted: string;
  border: string;
}> = {
  light:    { bg: '#F8F7F4', surface: '#FFFFFF', sidebar: '#F1EFEA', accent: '#34D399', text: '#0F172A', muted: '#64748B', border: '#E2E8F0' },
  pastel:   { bg: '#FDF6F0', surface: '#FFFFFF', sidebar: '#F5E6D3', accent: '#D4727A', text: '#3F2A2A', muted: '#8A6A6A', border: '#EAD7C5' },
  sage:     { bg: '#F0F4EF', surface: '#FFFFFF', sidebar: '#D4E2D0', accent: '#6B8F71', text: '#1F2D24', muted: '#5C7160', border: '#C7D6C2' },
  sand:     { bg: '#FAF6ED', surface: '#FFFFFF', sidebar: '#E8D5B5', accent: '#C49A4A', text: '#3D3220', muted: '#7A6A4A', border: '#DCC79C' },
  dark:     { bg: '#0F172A', surface: '#1E293B', sidebar: '#0B1120', accent: '#34D399', text: '#F1F5F9', muted: '#94A3B8', border: '#1E293B' },
  midnight: { bg: '#0D1B2A', surface: '#1B2838', sidebar: '#0A1420', accent: '#3B82F6', text: '#E2E8F0', muted: '#7C8DA3', border: '#1F2F44' },
  glass:    { bg: '#0B1120', surface: 'rgba(99,102,241,0.18)', sidebar: 'rgba(255,255,255,0.06)', accent: '#A78BFA', text: '#E2E8F0', muted: '#A0A8C0', border: 'rgba(255,255,255,0.08)' },
  contrast: { bg: '#000000', surface: '#0A0A0A', sidebar: '#000000', accent: '#00FF88', text: '#FFFFFF', muted: '#A1A1AA', border: '#1F1F1F' },
};

/** Miniature portal mock — sidebar + a couple of cards. */
function MiniPreview({ style }: { style: ThemeStyle }) {
  const c = PREVIEW[style];
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 10',
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: c.bg,
        border: `1px solid ${c.border}`,
        display: 'flex',
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: '26%',
          backgroundColor: c.sidebar,
          borderRight: `1px solid ${c.border}`,
          padding: '8px 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
        }}
      >
        <div style={{ width: '70%', height: 5, borderRadius: 999, backgroundColor: c.accent }} />
        <div style={{ width: '92%', height: 4, borderRadius: 999, backgroundColor: c.muted, opacity: 0.4 }} />
        <div style={{ width: '80%', height: 4, borderRadius: 999, backgroundColor: c.muted, opacity: 0.4 }} />
        <div style={{ width: '88%', height: 4, borderRadius: 999, backgroundColor: c.muted, opacity: 0.4 }} />
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Title bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: '40%', height: 6, borderRadius: 999, backgroundColor: c.text, opacity: 0.85 }} />
          <div style={{ flex: 1 }} />
          <div style={{ width: 18, height: 6, borderRadius: 999, backgroundColor: c.accent }} />
        </div>
        {/* Cards */}
        <div
          style={{
            backgroundColor: c.surface,
            border: `1px solid ${c.border}`,
            borderRadius: 6,
            padding: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            backdropFilter: style === 'glass' ? 'blur(6px)' : undefined,
          }}
        >
          <div style={{ width: '60%', height: 4, borderRadius: 999, backgroundColor: c.text, opacity: 0.7 }} />
          <div style={{ width: '90%', height: 3, borderRadius: 999, backgroundColor: c.muted, opacity: 0.45 }} />
          <div style={{ width: '70%', height: 3, borderRadius: 999, backgroundColor: c.muted, opacity: 0.45 }} />
        </div>
        <div
          style={{
            backgroundColor: c.surface,
            border: `1px solid ${c.border}`,
            borderRadius: 6,
            padding: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            backdropFilter: style === 'glass' ? 'blur(6px)' : undefined,
          }}
        >
          <div
            style={{ width: 12, height: 12, borderRadius: 999, backgroundColor: c.accent }}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ width: '70%', height: 3, borderRadius: 999, backgroundColor: c.text, opacity: 0.7 }} />
            <div style={{ width: '50%', height: 3, borderRadius: 999, backgroundColor: c.muted, opacity: 0.5 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function OnboardingAppearanceStep({
  selectedLight,
  selectedDark,
  onSelect,
  onContinue,
  onBack,
  name,
}: OnboardingAppearanceStepProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const Tile = ({ meta, idx }: { meta: typeof THEME_STYLES[number]; idx: number }) => {
    // A tile is "selected" if it's the saved pick for its own mode. The user
    // therefore ends up with one chosen Light and one chosen Dark theme,
    // mirroring the Settings → Appearance behavior.
    const isSelected = meta.isDarkBase
      ? selectedDark === meta.value
      : selectedLight === meta.value;
    const isRecommended = RECOMMENDED_THEMES.has(meta.value);
    return (
      <button
        type="button"
        onClick={() => onSelect?.(meta.value)}
        aria-pressed={isSelected}
        className="hugo-fade hugo-tile"
        style={{
          ['--d' as any]: `${260 + idx * 40}ms`,
          opacity: mounted ? undefined : 0,
          position: 'relative',
          padding: 8,
          borderRadius: 14,
          border: `2px solid ${isSelected ? 'var(--brand-green-text)' : 'color-mix(in srgb, var(--text-primary) 12%, transparent)'}`,
          backgroundColor: 'color-mix(in srgb, var(--text-primary) 4%, transparent)',
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          transition: 'transform 0.15s ease, border-color 0.15s ease, background-color 0.15s ease',
        }}
      >
        {isRecommended && (
          <span
            aria-label="Recommended"
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              zIndex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 9999,
              backgroundColor: 'var(--brand-green-text)',
              color: 'var(--on-brand-green, #fff)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              boxShadow: '0 4px 10px -4px color-mix(in srgb, var(--brand-green-text) 60%, transparent)',
            }}
          >
            <Sparkles style={{ width: 10, height: 10 }} />
            Recommended
          </span>
        )}
        <MiniPreview style={meta.value} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{meta.label}</span>
            <span style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>{meta.description}</span>
          </div>
          {isSelected && (
            <span
              aria-label="Selected"
              style={{
                width: 20,
                height: 20,
                borderRadius: 9999,
                backgroundColor: 'var(--brand-green-text)',
                color: 'var(--on-brand-green, #fff)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Check style={{ width: 12, height: 12 }} />
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-appearance-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        backgroundColor: 'var(--bg-offwhite, #0b0e14)',
        color: 'var(--text-primary)',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px',
        boxShadow: 'inset 0 0 200px rgba(0,0,0,0.25)',
      }}
    >
      {/* Aurora */}
      <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <span className="hugo-blob hugo-blob-1" />
        <span className="hugo-blob hugo-blob-2" />
        <span className="hugo-blob hugo-blob-3" />
      </div>

      {/* Hero */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 920,
          margin: 'auto 0',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 22,
          paddingTop: 56,
          paddingBottom: 32,
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
          Step 3 of 3
        </span>

        {/* Title */}
        <h1
          id="onboarding-appearance-title"
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
          Choose your appearance{name ? `, ${name}` : ''}
        </h1>

        {/* Subtext */}
        <p
          className="hugo-fade"
          style={{
            ['--d' as any]: '220ms',
            margin: 0,
            maxWidth: 580,
            fontSize: 'clamp(14px, 1.5vw, 16px)',
            lineHeight: 1.55,
            color: 'var(--text-secondary)',
            opacity: mounted ? undefined : 0,
          }}
        >
          Pick one Light and one Dark theme. The app will switch between them
          whenever you toggle modes.
        </p>

        {/* Light themes */}
        <div
          className="hugo-fade"
          style={{
            ['--d' as any]: '260ms',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            opacity: mounted ? undefined : 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            <Sun style={{ width: 13, height: 13 }} /> Light
          </div>
          <div className="hugo-grid">
            {LIGHT_THEMES.map((meta, i) => (
              <Tile key={meta.value} meta={meta} idx={i} />
            ))}
          </div>
        </div>

        {/* Dark themes */}
        <div
          className="hugo-fade"
          style={{
            ['--d' as any]: '320ms',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            opacity: mounted ? undefined : 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            <Moon style={{ width: 13, height: 13 }} /> Dark
          </div>
          <div className="hugo-grid">
            {DARK_THEMES.map((meta, i) => (
              <Tile key={meta.value} meta={meta} idx={LIGHT_THEMES.length + i} />
            ))}
          </div>
        </div>

        {/* CTA */}
        <div
          className="hugo-fade"
          style={{
            ['--d' as any]: '560ms',
            display: 'flex',
            gap: 10,
            justifyContent: 'center',
            marginTop: 8,
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
            Finish setup &amp; start tour
            <ArrowRight style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* Footer reassurance */}
        <p
          className="hugo-fade"
          style={{
            ['--d' as any]: '640ms',
            margin: '4px 0 0',
            fontSize: 12,
            color: 'var(--text-secondary)',
            opacity: mounted ? undefined : 0,
          }}
        >
          You can switch themes anytime from Settings → Appearance.
        </p>
      </div>

      {/* Back button */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          style={{
            position: 'fixed',
            top: 18,
            left: 18,
            width: 36,
            height: 36,
            borderRadius: 9999,
            border: '1px solid color-mix(in srgb, var(--text-primary) 14%, transparent)',
            backgroundColor: 'color-mix(in srgb, var(--bg-offwhite, #0b0e14) 80%, transparent)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)',
            zIndex: 1,
          }}
          className="hover:!text-[var(--text-primary)]"
        >
          <ArrowRight style={{ width: 16, height: 16, transform: 'rotate(180deg)' }} />
        </button>
      )}

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
        .hugo-tile:hover { transform: translateY(-2px); }
        .hugo-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        @media (min-width: 720px) {
          .hugo-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        }
        .hugo-blob {
          position: absolute;
          width: 520px; height: 520px;
          border-radius: 9999px;
          filter: blur(90px);
          opacity: 0.35;
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
          opacity: 0.25;
        }
        @media (prefers-reduced-motion: reduce) {
          .hugo-fade, .hugo-blob, .hugo-tile { animation: none !important; transition: none !important; }
          .hugo-fade { opacity: 1 !important; transform: none !important; }
        }
      `}</style>
    </div>
  );
}

export default OnboardingAppearanceStep;
