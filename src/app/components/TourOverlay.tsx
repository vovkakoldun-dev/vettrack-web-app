import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Sparkles, X } from 'lucide-react';

export interface TourAction {
  /** Button label, e.g. "Show me more". */
  label: string;
  /** Route to navigate to before the sub-tour starts. */
  path: string;
  /** Steps to run after navigating. */
  steps: TourStep[];
}

export interface TourStep {
  /** CSS selector of the element to spotlight. Omit for a centered card. */
  selector?: string;
  /** Heading shown in the tooltip card. */
  title: string;
  /** Body copy shown under the heading. */
  description: string;
  /** Padding applied around the target's bounding box, in pixels. */
  pad?: number;
  /** Preferred tooltip placement when there's room. */
  placement?: 'auto' | 'right' | 'left' | 'top' | 'bottom';
  /** Optional drill-down — adds a "Show me more" CTA to the tooltip. */
  action?: TourAction;
  /** Custom node rendered between the description and the progress bar.
   *  Useful for inline visual demos (e.g., an animated reactions showcase). */
  extra?: ReactNode;
  /** Navigate to this path right before measuring the spotlight.
   *  Useful for steps that bridge between two pages mid-tour. The function
   *  form is resolved at runtime, so you can pick e.g. the first row id. */
  navigateTo?: string | (() => string | null);
}

interface TourOverlayProps {
  steps: TourStep[];
  /** Controls visibility. Setting to false dismisses the tour. */
  open: boolean;
  /** Index to start at whenever `open` flips from false → true. */
  startIndex?: number;
  /** Called when the user finishes or skips the tour. */
  onClose: () => void;
  /** Called when the user clicks the step's "Show me more" CTA. */
  onAction?: (action: TourAction, currentStepIndex: number) => void;
  /** Fired instead of onClose when the user clicks the final-step CTA.
   *  Lets a sub-tour return control to its parent tour. */
  onComplete?: () => void;
  /** Custom label for the final-step CTA (default: "Done"). */
  completeLabel?: string;
  /** Called when the active step has `navigateTo` set. Wire to react-router. */
  onNavigate?: (path: string) => void;
}

interface Rect { top: number; left: number; width: number; height: number; }

const TOOLTIP_W = 340;
const TOOLTIP_GAP = 16;

/**
 * Lightweight product tour. Each step optionally targets a DOM element via
 * a CSS selector; the overlay dims everything except a "hole" around that
 * element and parks a tooltip card next to it. Steps without a selector
 * render a centered card (good for intro/outro screens).
 */
export function TourOverlay({
  steps,
  open,
  startIndex = 0,
  onClose,
  onAction,
  onComplete,
  completeLabel,
  onNavigate,
}: TourOverlayProps) {
  const [idx, setIdx] = useState(startIndex);
  const [rect, setRect] = useState<Rect | null>(null);
  const total = steps.length;
  const step = steps[idx];

  // Keep the index in range when the step list changes.
  useEffect(() => { if (idx >= total) setIdx(Math.max(0, total - 1)); }, [total, idx]);

  // Jump to the requested start index whenever the tour reopens. We also
  // re-apply when startIndex changes mid-flight (e.g., resuming a parent
  // tour from a sub-tour).
  useEffect(() => { if (open) setIdx(startIndex); }, [open, startIndex]);

  // Run navigateTo (if any) when this step becomes active. Done before the
  // measure effect so the new page has a head-start before we search for
  // the target.
  useEffect(() => {
    if (!open || !step?.navigateTo) return;
    const path = typeof step.navigateTo === 'function' ? step.navigateTo() : step.navigateTo;
    if (path) onNavigate?.(path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idx, step?.navigateTo]);

  // Find the target element + track its bounding box (recompute on resize/scroll).
  useLayoutEffect(() => {
    if (!open) return;
    if (!step?.selector) { setRect(null); return; }

    let cancelled = false;
    const find = () => {
      const el = document.querySelector(step.selector!) as HTMLElement | null;
      if (!el) { if (!cancelled) setRect(null); return; }
      // Make sure the target is in view before measuring.
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
      const r = el.getBoundingClientRect();
      if (!cancelled) {
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      }
    };

    find();
    const onChange = () => find();
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, true);
    // Retries cover cases where the target mounts a tick later — including
    // route transitions that may take a moment to render.
    const retries = [80, 200, 500, 1000, 1800].map(d => window.setTimeout(find, d));

    return () => {
      cancelled = true;
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, true);
      retries.forEach(clearTimeout);
    };
  }, [open, idx, step?.selector]);

  // Keyboard navigation.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idx, total]);

  const tooltipPos = useMemo(() => {
    if (!rect) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)' as const,
      };
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = step?.pad ?? 8;
    const r = {
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    };
    // Try right, then bottom, then left, then top.
    const placements = step?.placement && step.placement !== 'auto'
      ? [step.placement]
      : ['right', 'bottom', 'left', 'top'] as const;
    for (const p of placements) {
      if (p === 'right' && r.left + r.width + TOOLTIP_GAP + TOOLTIP_W < vw) {
        return {
          top: Math.min(Math.max(r.top, 16), vh - 220),
          left: r.left + r.width + TOOLTIP_GAP,
        };
      }
      if (p === 'left' && r.left - TOOLTIP_GAP - TOOLTIP_W > 0) {
        return {
          top: Math.min(Math.max(r.top, 16), vh - 220),
          left: r.left - TOOLTIP_GAP - TOOLTIP_W,
        };
      }
      if (p === 'bottom' && r.top + r.height + TOOLTIP_GAP + 200 < vh) {
        return {
          top: r.top + r.height + TOOLTIP_GAP,
          left: Math.min(Math.max(r.left, 16), vw - TOOLTIP_W - 16),
        };
      }
      if (p === 'top' && r.top - TOOLTIP_GAP - 200 > 0) {
        return {
          top: r.top - TOOLTIP_GAP - 200,
          left: Math.min(Math.max(r.left, 16), vw - TOOLTIP_W - 16),
        };
      }
    }
    // Fallback — centered.
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)' as const,
    };
  }, [rect, step?.placement, step?.pad]);

  if (!open || !step) return null;

  const goNext = () => {
    if (idx < total - 1) setIdx(idx + 1);
    else (onComplete ?? onClose)();
  };
  const goPrev = () => { if (idx > 0) setIdx(idx - 1); };

  const pad = step.pad ?? 8;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Product tour"
      // Wrapper itself doesn't capture clicks — children do, with explicit
      // pointer-events on the tooltip. zIndex sits above Radix Dialog
      // portals (which default to z-50) and any other app overlays.
      style={{ position: 'fixed', inset: 0, zIndex: 2147483646, pointerEvents: 'none' }}
    >
      {/* Spotlight: a transparent rect with a giant box-shadow that dims
          everything else. Pointer events disabled so the user can't
          accidentally interact with the underlying app. */}
      {rect ? (
        <div
          aria-hidden
          className="vt-spotlight"
          style={{
            position: 'fixed',
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            borderRadius: 12,
            transition: 'top 0.3s ease, left 0.3s ease, width 0.3s ease, height 0.3s ease',
            pointerEvents: 'none',
          }}
        />
      ) : (
        <div
          aria-hidden
          // Centered-card backdrop — must accept clicks for click-outside-to-close.
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(2, 6, 23, 0.72)',
            backdropFilter: 'blur(2px)',
            pointerEvents: 'auto',
          }}
          onClick={onClose}
        />
      )}

      {/* Tooltip card */}
      <div
        role="document"
        style={{
          position: 'fixed',
          width: TOOLTIP_W,
          maxWidth: 'calc(100vw - 32px)',
          padding: '18px 20px 16px',
          borderRadius: 14,
          backgroundColor: 'var(--surface-white)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 24px 60px -12px rgba(0,0,0,0.45), 0 0 0 1px color-mix(in srgb, var(--brand-green-text) 20%, transparent)',
          // Re-enable pointer events here so buttons inside the tooltip
          // receive clicks even when a Radix Dialog is open underneath.
          pointerEvents: 'auto',
          ...tooltipPos,
          transition: 'top 0.3s ease, left 0.3s ease',
        }}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Skip tour"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            width: 26,
            height: 26,
            borderRadius: 9999,
            border: 'none',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          className="hover:!bg-[color-mix(in_srgb,var(--text-primary)_8%,transparent)]"
        >
          <X style={{ width: 14, height: 14 }} />
        </button>

        {/* Eyebrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 9999,
            backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 14%, transparent)',
            color: 'var(--brand-green-text)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            <Sparkles style={{ width: 10, height: 10 }} /> Tour
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
            {idx + 1} / {total}
          </span>
        </div>

        {/* Title + body */}
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, lineHeight: 1.25 }}>
          {step.title}
        </h3>
        <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
          {step.description}
        </p>

        {step.extra && <div style={{ marginTop: 12 }}>{step.extra}</div>}

        {/* Progress bar */}
        <div style={{ marginTop: 14, height: 3, borderRadius: 9999, backgroundColor: 'color-mix(in srgb, var(--text-primary) 8%, transparent)', overflow: 'hidden' }}>
          <div
            style={{
              width: `${((idx + 1) / total) * 100}%`,
              height: '100%',
              backgroundColor: 'var(--brand-green-text)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        {/* Optional drill-down CTA — shows above the navigation row. */}
        {step.action && (
          <button
            type="button"
            onClick={() => onAction?.(step.action!, idx)}
            style={{
              marginTop: 12,
              width: '100%',
              padding: '9px 14px',
              borderRadius: 10,
              border: '1px solid color-mix(in srgb, var(--brand-green-text) 35%, transparent)',
              backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 12%, transparent)',
              color: 'var(--brand-green-text)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'background-color 0.15s ease',
            }}
            className="hover:!bg-[color-mix(in_srgb,var(--brand-green-text)_22%,transparent)]"
          >
            <Sparkles style={{ width: 12, height: 12 }} />
            {step.action.label}
            <ArrowRight style={{ width: 12, height: 12 }} />
          </button>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 14 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '7px 12px',
              borderRadius: 9999,
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Skip tour
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={goPrev}
              disabled={idx === 0}
              style={{
                padding: '7px 12px',
                borderRadius: 9999,
                border: '1px solid var(--border-color)',
                backgroundColor: 'transparent',
                color: idx === 0 ? 'color-mix(in srgb, var(--text-secondary) 50%, transparent)' : 'var(--text-primary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: idx === 0 ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <ArrowLeft style={{ width: 12, height: 12 }} /> Back
            </button>
            <button
              type="button"
              onClick={goNext}
              style={{
                padding: '7px 14px',
                borderRadius: 9999,
                border: 'none',
                backgroundColor: 'var(--brand-green-text)',
                color: 'var(--on-brand-green, #fff)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
              className="hover:opacity-90 active:scale-[0.98]"
            >
              {idx === total - 1 ? (completeLabel ?? 'Done') : 'Next'}
              <ArrowRight style={{ width: 12, height: 12 }} />
            </button>
          </div>
        </div>
      </div>

      {/* Spotlight visuals — bright outline + soft pulsing glow ring + the
          dimming overlay applied via box-shadow.
          Also hides any open Radix Dialog overlay so the page doesn't end
          up double-dimmed when the tour is on top of a dialog. */}
      <style>{`
        [data-slot="dialog-overlay"] { opacity: 0 !important; }
        @keyframes vtSpotlightPulse {
          0%, 100% {
            box-shadow:
              0 0 0 9999px rgba(2, 6, 23, 0.72),
              0 0 0 2px color-mix(in srgb, var(--brand-green-text) 90%, transparent),
              0 0 0 8px color-mix(in srgb, var(--brand-green-text) 35%, transparent),
              0 0 24px 6px color-mix(in srgb, var(--brand-green-text) 30%, transparent);
          }
          50% {
            box-shadow:
              0 0 0 9999px rgba(2, 6, 23, 0.72),
              0 0 0 2px color-mix(in srgb, var(--brand-green-text) 100%, transparent),
              0 0 0 14px color-mix(in srgb, var(--brand-green-text) 18%, transparent),
              0 0 36px 12px color-mix(in srgb, var(--brand-green-text) 50%, transparent);
          }
        }
        .vt-spotlight {
          animation: vtSpotlightPulse 2.4s ease-in-out infinite;
          will-change: box-shadow;
        }
        @media (prefers-reduced-motion: reduce) {
          .vt-spotlight {
            animation: none;
            box-shadow:
              0 0 0 9999px rgba(2, 6, 23, 0.72),
              0 0 0 2px color-mix(in srgb, var(--brand-green-text) 90%, transparent),
              0 0 0 6px color-mix(in srgb, var(--brand-green-text) 30%, transparent);
          }
        }
      `}</style>
    </div>
  );
}

export default TourOverlay;
