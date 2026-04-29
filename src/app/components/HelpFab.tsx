import { useEffect, useMemo, useRef, useState } from 'react';
import { HelpCircle, Play, MousePointerClick, X, Sparkles, Bug, Send, CheckCircle2, Loader2 } from 'lucide-react';
import {
  DOCTOR_TOUR_STEPS,
  DASHBOARD_TOUR_STEPS,
  MY_PORTAL_TOUR_STEPS,
  CLIENTS_TOUR_STEPS,
  CHAT_TOUR_STEPS,
  APPOINTMENTS_TOUR_STEPS,
} from './tourSteps';
import type { TourStep } from './TourOverlay';

interface ExplainEntry {
  title: string;
  description: string;
}

/** Build a lookup of `data-tour` key → { title, description } from every
 *  defined tour step, so any element marked for the tour also gets a free
 *  "Explain me" tooltip. */
function buildExplainRegistry(): Map<string, ExplainEntry> {
  const registry = new Map<string, ExplainEntry>();
  const collect = (steps: TourStep[]) => {
    for (const s of steps) {
      const m = s.selector?.match(/\[data-tour="(.+?)"\]/);
      if (m) registry.set(m[1], { title: s.title, description: s.description });
    }
  };
  collect(DOCTOR_TOUR_STEPS);
  collect(DASHBOARD_TOUR_STEPS);
  collect(MY_PORTAL_TOUR_STEPS);
  collect(CLIENTS_TOUR_STEPS);
  collect(CHAT_TOUR_STEPS);
  collect(APPOINTMENTS_TOUR_STEPS);
  return registry;
}

interface PopupState {
  rect: { top: number; left: number; width: number; height: number };
  title: string;
  description: string;
}

/**
 * Floating help button (bottom-right) with two actions:
 *  • Start the product tour from the beginning.
 *  • Enter "Explain me" mode — hover any tour-tagged element to see what
 *    it is, click for a detailed pop-up, Esc to leave.
 */
type ReportState =
  | { phase: 'closed' }
  | { phase: 'open'; subject: string; description: string }
  | { phase: 'sending'; subject: string; description: string }
  | { phase: 'sent' };

export function HelpFab() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [explainMode, setExplainMode] = useState(false);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [report, setReport] = useState<ReportState>({ phase: 'closed' });
  const explainModeRef = useRef(explainMode);
  explainModeRef.current = explainMode;

  const registry = useMemo(buildExplainRegistry, []);

  // Custom-cursor element imperatively positioned via mouse events.
  // Using a ref + direct DOM writes avoids re-rendering React on every
  // mousemove, which is critical for 60fps cursor tracking.
  const cursorRef = useRef<HTMLDivElement | null>(null);
  // Hover ring is also DOM-driven so element changes don't ping React.
  const hoverRingRef = useRef<HTMLDivElement | null>(null);
  // Last hovered explainable — kept in a ref so mousemove can early-out
  // when the same element is still under the cursor.
  const hoverElRef = useRef<HTMLElement | null>(null);

  // ── Dropdown auto-close on outside click ──────────────────────────────
  const fabRootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (fabRootRef.current && !fabRootRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  // ── Explain-mode mouse + key handlers ─────────────────────────────────
  useEffect(() => {
    if (!explainMode) {
      setPopup(null);
      hoverElRef.current = null;
      const ring = hoverRingRef.current;
      if (ring) ring.style.opacity = '0';
      return;
    }

    /** Walk up the DOM until we find something explainable. Two sources:
     *  1. `data-tour` keys that are also in the tour registry (auto-derived
     *     from tour steps).
     *  2. Inline `data-explain-title` (+ optional `data-explain-desc`) — for
     *     sections that aren't in the product tour but should still be
     *     explainable on demand. */
    const findExplainable = (el: Element | null): HTMLElement | null => {
      let cur: Element | null = el;
      while (cur && cur !== document.body) {
        if (cur instanceof HTMLElement) {
          if (cur.dataset.tour && registry.has(cur.dataset.tour)) return cur;
          if (cur.dataset.explainTitle) return cur;
        }
        cur = cur.parentElement;
      }
      return null;
    };

    const explanationFor = (el: HTMLElement): ExplainEntry | null => {
      if (el.dataset.tour && registry.has(el.dataset.tour)) {
        return registry.get(el.dataset.tour)!;
      }
      if (el.dataset.explainTitle) {
        return {
          title: el.dataset.explainTitle,
          description: el.dataset.explainDesc || '',
        };
      }
      return null;
    };

    const onMove = (e: MouseEvent) => {
      // Are we over an explain-mode control (FAB, banner Done, popup X)?
      // If so, hand the cursor back to the browser so the user sees a
      // normal pointer instead of the bubble.
      const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const overControl = !!target?.closest('[data-explain-control]');

      // 1. Cursor follow — direct DOM, runs on every event for smoothness.
      const c = cursorRef.current;
      if (c) {
        c.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
        c.style.opacity = overControl ? '0' : '1';
      }
      document.body.classList.toggle('vt-explain-show-pointer', overControl);

      // 2. Hover detection — only do work when the hovered element changes,
      //    not on every pixel of movement.
      const el = overControl ? null : findExplainable(target);
      if (el === hoverElRef.current) return;
      hoverElRef.current = el;

      if (c) c.classList.toggle('vt-bubble-active', !!el);

      // 3. Hover ring — also DOM-driven so changing target doesn't re-render.
      const ring = hoverRingRef.current;
      if (ring) {
        if (el) {
          const r = el.getBoundingClientRect();
          ring.style.transform = `translate3d(${r.left - 4}px, ${r.top - 4}px, 0)`;
          ring.style.width = `${r.width + 8}px`;
          ring.style.height = `${r.height + 8}px`;
          ring.style.opacity = '1';
        } else {
          ring.style.opacity = '0';
        }
      }
    };

    const onClick = (e: MouseEvent) => {
      const el = findExplainable(e.target as Element);
      if (!el) return;
      // Take over the click — don't fire the underlying handler.
      e.preventDefault();
      e.stopPropagation();
      const entry = explanationFor(el);
      if (!entry) return;
      const r = el.getBoundingClientRect();
      setPopup({
        rect: { top: r.top, left: r.left, width: r.width, height: r.height },
        title: entry.title,
        description: entry.description,
      });
      // Fire a quick click-pulse on the bubble.
      const c = cursorRef.current;
      if (c) {
        c.classList.add('vt-bubble-clicked');
        window.setTimeout(() => c?.classList.remove('vt-bubble-clicked'), 450);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (popup) setPopup(null);
        else setExplainMode(false);
      }
    };

    document.addEventListener('mousemove', onMove);
    // Capture clicks before they reach the page so we can intercept them.
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explainMode, popup]);

  // Make the cursor universal while in explain mode.
  useEffect(() => {
    if (explainMode) document.body.classList.add('vt-explain-mode');
    else document.body.classList.remove('vt-explain-mode');
    return () => document.body.classList.remove('vt-explain-mode');
  }, [explainMode]);

  // ── Tour kickoff ──────────────────────────────────────────────────────
  const startTour = () => {
    setMenuOpen(false);
    window.dispatchEvent(new CustomEvent('vettrack:start-tour'));
  };

  const enterExplain = () => {
    setMenuOpen(false);
    setExplainMode(true);
  };

  const openReport = () => {
    setMenuOpen(false);
    setReport({ phase: 'open', subject: '', description: '' });
  };

  const submitReport = () => {
    if (report.phase !== 'open' || !report.description.trim()) return;
    const payload = {
      subject: report.subject.trim() || '(no subject)',
      description: report.description.trim(),
      path: window.location.pathname + window.location.search,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };
    setReport({ phase: 'sending', subject: report.subject, description: report.description });
    // Broadcast for any listener (dev console, future Supabase hook, etc.).
    window.dispatchEvent(new CustomEvent('vettrack:report-submitted', { detail: payload }));
    // eslint-disable-next-line no-console
    console.info('[report]', payload);
    // Simulate a quick send so the UX feels responsive.
    window.setTimeout(() => setReport({ phase: 'sent' }), 450);
    window.setTimeout(() => setReport({ phase: 'closed' }), 2400);
  };

  return (
    <>
      {/* ── FAB + dropdown ── */}
      <div
        ref={fabRootRef}
        data-explain-control
        style={{
          position: 'fixed',
          right: 18,
          bottom: 18,
          // Stays under the tour overlay (z-2147483646) but above the app.
          zIndex: 1500,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 10,
        }}
      >
        {menuOpen && (
          <div
            role="menu"
            style={{
              minWidth: 220,
              padding: 6,
              borderRadius: 12,
              backgroundColor: 'var(--surface-white)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 16px 40px -8px rgba(0,0,0,0.35), 0 0 0 1px color-mix(in srgb, var(--brand-green-text) 15%, transparent)',
              animation: 'vtFabFade 0.15s ease-out',
            }}
          >
            <button
              type="button"
              onClick={startTour}
              role="menuitem"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
              }}
              className="hover:!bg-[var(--surface-elevated)]"
            >
              <span
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 14%, transparent)',
                  color: 'var(--brand-green-text)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Play style={{ width: 13, height: 13, fill: 'currentColor' }} />
              </span>
              Start tutorial again
            </button>

            <button
              type="button"
              onClick={enterExplain}
              role="menuitem"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
              }}
              className="hover:!bg-[var(--surface-elevated)]"
            >
              <span
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  backgroundColor: 'color-mix(in srgb, #6366F1 14%, transparent)',
                  color: '#6366F1',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <MousePointerClick style={{ width: 14, height: 14 }} />
              </span>
              Explain me…
            </button>

            <button
              type="button"
              onClick={openReport}
              role="menuitem"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
              }}
              className="hover:!bg-[var(--surface-elevated)]"
            >
              <span
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  backgroundColor: 'color-mix(in srgb, #EF4444 14%, transparent)',
                  color: '#EF4444',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Bug style={{ width: 14, height: 14 }} />
              </span>
              Report a problem
            </button>
          </div>
        )}

        <button
          type="button"
          aria-label={
            explainMode ? 'Exit Explain mode' : (menuOpen ? 'Close help' : 'Open help')
          }
          title={explainMode ? 'Exit Explain mode' : undefined}
          onClick={() => {
            if (explainMode) {
              setExplainMode(false);
              return;
            }
            setMenuOpen((v) => !v);
          }}
          style={{
            width: 48, height: 48,
            borderRadius: 9999,
            border: 'none',
            backgroundColor: explainMode ? '#6366F1' : 'var(--brand-green-text)',
            color: 'var(--on-brand-green, #fff)',
            cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: explainMode
              ? '0 12px 28px -10px rgba(99,102,241,0.6), 0 6px 14px rgba(0,0,0,0.18)'
              : '0 12px 28px -10px color-mix(in srgb, var(--brand-green-text) 60%, transparent), 0 6px 14px rgba(0,0,0,0.18)',
            transition: 'transform 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease',
          }}
          className="hover:scale-105 active:scale-95"
        >
          {(explainMode || menuOpen) ? <X style={{ width: 20, height: 20 }} /> : <HelpCircle style={{ width: 22, height: 22 }} />}
        </button>
      </div>

      {/* ── Explain-mode banner + hover ring + click popup ── */}
      {explainMode && (
        <>
          {/* Custom animated cursor — replaces the native pointer.
              Positioned imperatively via the mousemove handler to keep
              animation smooth without re-rendering on every pixel. */}
          <div
            ref={cursorRef}
            aria-hidden
            className="vt-bubble"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: 0,
              height: 0,
              pointerEvents: 'none',
              zIndex: 2000,
              opacity: 0,
              transition: 'opacity 0.2s ease',
            }}
          >
            <span className="vt-bubble-ring" />
            <span className="vt-bubble-ring vt-bubble-ring-2" />
            <span className="vt-bubble-core">
              <HelpCircle style={{ width: 18, height: 18 }} />
            </span>
          </div>

          {/* Top banner */}
          <div
            data-explain-control
            style={{
              position: 'fixed',
              top: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1500,
              padding: '8px 14px',
              borderRadius: 9999,
              backgroundColor: '#0F172A',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              boxShadow: '0 16px 40px -8px rgba(0,0,0,0.45)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              pointerEvents: 'auto',
            }}
          >
            <Sparkles style={{ width: 13, height: 13, color: '#A5B4FC' }} />
            <span>Click any highlighted element to learn about it</span>
            <button
              type="button"
              onClick={() => setExplainMode(false)}
              style={{
                marginLeft: 6,
                padding: '4px 10px',
                borderRadius: 9999,
                border: '1px solid rgba(255,255,255,0.18)',
                backgroundColor: 'transparent',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
              className="hover:!bg-[rgba(255,255,255,0.08)]"
            >
              Done
            </button>
          </div>

          {/* Hover ring — positioned via direct DOM writes from mousemove,
              so changing element doesn't trigger React re-renders. Hidden
              when a popup is pinned (via inline opacity from React). */}
          <div
            ref={hoverRingRef}
            aria-hidden
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: 0,
              height: 0,
              borderRadius: 10,
              pointerEvents: 'none',
              zIndex: 1499,
              opacity: 0,
              boxShadow:
                '0 0 0 2px #6366F1, ' +
                '0 0 0 6px color-mix(in srgb, #6366F1 25%, transparent), ' +
                '0 0 24px 4px color-mix(in srgb, #6366F1 30%, transparent)',
              transition: 'opacity 0.18s ease, transform 0.12s ease, width 0.12s ease, height 0.12s ease',
              visibility: popup ? 'hidden' : 'visible',
            }}
          />

          {/* Popup */}
          {popup && (() => {
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const POPUP_W = 320;
            const r = popup.rect;
            // Try right, then bottom, else center.
            let pos: React.CSSProperties = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
            if (r.left + r.width + 16 + POPUP_W < vw) {
              pos = { top: Math.min(Math.max(r.top, 16), vh - 200), left: r.left + r.width + 16 };
            } else if (r.top + r.height + 16 + 200 < vh) {
              pos = { top: r.top + r.height + 16, left: Math.min(Math.max(r.left, 16), vw - POPUP_W - 16) };
            } else if (r.left - 16 - POPUP_W > 0) {
              pos = { top: Math.min(Math.max(r.top, 16), vh - 200), left: r.left - 16 - POPUP_W };
            }
            return (
              <>
                {/* Pinned ring around the explained element */}
                <div
                  aria-hidden
                  style={{
                    position: 'fixed',
                    top: r.top - 4,
                    left: r.left - 4,
                    width: r.width + 8,
                    height: r.height + 8,
                    borderRadius: 10,
                    pointerEvents: 'none',
                    zIndex: 1499,
                    boxShadow: '0 0 0 2px #6366F1, 0 0 0 8px color-mix(in srgb, #6366F1 22%, transparent)',
                  }}
                />
                <div
                  role="dialog"
                  aria-modal="false"
                  data-explain-control
                  style={{
                    position: 'fixed',
                    width: POPUP_W,
                    maxWidth: 'calc(100vw - 32px)',
                    padding: '16px 18px 14px',
                    borderRadius: 12,
                    backgroundColor: 'var(--surface-white)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    boxShadow:
                      '0 24px 60px -12px rgba(0,0,0,0.45), 0 0 0 1px color-mix(in srgb, #6366F1 25%, transparent)',
                    zIndex: 1501,
                    pointerEvents: 'auto',
                    ...pos,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setPopup(null)}
                    aria-label="Close"
                    style={{
                      position: 'absolute',
                      top: 8, right: 8,
                      width: 24, height: 24,
                      borderRadius: 9999,
                      border: 'none', backgroundColor: 'transparent',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    className="hover:!bg-[color-mix(in_srgb,var(--text-primary)_8%,transparent)]"
                  >
                    <X style={{ width: 13, height: 13 }} />
                  </button>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      borderRadius: 9999,
                      backgroundColor: 'color-mix(in srgb, #6366F1 14%, transparent)',
                      color: '#6366F1',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      marginBottom: 8,
                    }}
                  >
                    <Sparkles style={{ width: 10, height: 10 }} /> What is this?
                  </span>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, lineHeight: 1.25 }}>{popup.title}</h3>
                  <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
                    {popup.description}
                  </p>
                </div>
              </>
            );
          })()}
        </>
      )}

      {/* ── Report a problem modal ── */}
      {report.phase !== 'closed' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Report a problem"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            backgroundColor: 'rgba(2, 6, 23, 0.6)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            animation: 'vtFabFade 0.18s ease-out',
          }}
          onClick={() => report.phase === 'open' && setReport({ phase: 'closed' })}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 460,
              maxWidth: '100%',
              borderRadius: 14,
              backgroundColor: 'var(--surface-white)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 32px 70px -16px rgba(0,0,0,0.5)',
              padding: '20px 22px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {report.phase === 'sent' ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '14px 0' }}>
                <span
                  style={{
                    width: 44, height: 44, borderRadius: 9999,
                    backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 16%, transparent)',
                    color: 'var(--brand-green-text)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <CheckCircle2 style={{ width: 22, height: 22 }} />
                </span>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Report sent</h3>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 320 }}>
                  Thanks — we read every report and use them to make the app better.
                </p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      width: 32, height: 32, borderRadius: 9,
                      backgroundColor: 'color-mix(in srgb, #EF4444 14%, transparent)',
                      color: '#EF4444',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Bug style={{ width: 16, height: 16 }} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Report a problem</h3>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                      Tell us what went wrong — we'll get on it.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReport({ phase: 'closed' })}
                    aria-label="Close"
                    disabled={report.phase === 'sending'}
                    style={{
                      width: 28, height: 28, borderRadius: 9999,
                      border: 'none', backgroundColor: 'transparent',
                      color: 'var(--text-secondary)', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    className="hover:!bg-[color-mix(in_srgb,var(--text-primary)_8%,transparent)]"
                  >
                    <X style={{ width: 14, height: 14 }} />
                  </button>
                </div>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Subject (optional)</span>
                  <input
                    type="text"
                    value={report.phase === 'sending' ? report.subject : (report as { subject: string }).subject}
                    onChange={(e) => report.phase === 'open' && setReport({ ...report, subject: e.target.value })}
                    disabled={report.phase === 'sending'}
                    placeholder="Short summary"
                    style={{
                      height: 36,
                      padding: '0 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--input-background, var(--surface-white))',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>What happened?</span>
                  <textarea
                    value={report.phase === 'sending' ? report.description : (report as { description: string }).description}
                    onChange={(e) => report.phase === 'open' && setReport({ ...report, description: e.target.value })}
                    disabled={report.phase === 'sending'}
                    placeholder="Steps you took, what you expected, what actually happened…"
                    rows={5}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--input-background, var(--surface-white))',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      lineHeight: 1.5,
                      outline: 'none',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                    }}
                  />
                </label>

                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)' }}>
                  We attach your current page and browser info automatically — never any personal data.
                </p>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => setReport({ phase: 'closed' })}
                    disabled={report.phase === 'sending'}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 9999,
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'transparent',
                      color: 'var(--text-secondary)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: report.phase === 'sending' ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitReport}
                    disabled={report.phase === 'sending' || (report.phase === 'open' && !report.description.trim())}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 9999,
                      border: 'none',
                      backgroundColor: 'var(--brand-green-text)',
                      color: 'var(--on-brand-green, #fff)',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      opacity: (report.phase === 'open' && !report.description.trim()) ? 0.55 : 1,
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                    className="hover:opacity-90"
                  >
                    {report.phase === 'sending' ? (
                      <>
                        <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" />
                        Sending…
                      </>
                    ) : (
                      <>
                        <Send style={{ width: 13, height: 13 }} />
                        Send report
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes vtFabFade {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Hide the native cursor while explain mode is active — the
           floating bubble takes over the pointer. */
        body.vt-explain-mode,
        body.vt-explain-mode *,
        body.vt-explain-mode [data-tour] {
          cursor: none !important;
        }
        /* Restore the native pointer over explain-mode controls
           (the FAB, banner buttons, popup buttons). The bubble itself
           is hidden via JS while over these. */
        body.vt-explain-mode [data-explain-control],
        body.vt-explain-mode [data-explain-control] * {
          cursor: pointer !important;
        }
        body.vt-explain-mode.vt-explain-show-pointer,
        body.vt-explain-mode.vt-explain-show-pointer * {
          cursor: pointer !important;
        }

        /* ── Bubble cursor ──────────────────────────────────────── */
        .vt-bubble {
          /* The wrapper is a 0×0 anchor; everything inside is centered
             on that point and visible via overflow. */
          will-change: transform;
        }
        .vt-bubble-core,
        .vt-bubble-ring {
          position: absolute;
          top: 0; left: 0;
          transform: translate(-50%, -50%);
          border-radius: 9999px;
          pointer-events: none;
        }
        .vt-bubble-core {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #6366F1 0%, #A78BFA 60%, #F472B6 100%);
          background-size: 180% 180%;
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow:
            0 6px 18px -4px rgba(99,102,241,0.5),
            inset 0 0 0 1.5px rgba(255,255,255,0.18);
          animation:
            vtBubbleFloat 2.6s ease-in-out infinite,
            vtBubbleHue 7s ease-in-out infinite;
        }
        .vt-bubble-ring {
          width: 36px;
          height: 36px;
          border: 2px solid rgba(99,102,241,0.7);
          opacity: 0;
          animation: vtBubbleRipple 1.6s cubic-bezier(0.22, 1, 0.36, 1) infinite;
        }
        .vt-bubble-ring-2 {
          animation-delay: 0.8s;
        }

        /* "Active" — hovering an explainable. Bubble grows + rings tighten. */
        .vt-bubble.vt-bubble-active .vt-bubble-core {
          animation:
            vtBubbleFloatActive 1.4s ease-in-out infinite,
            vtBubbleHue 5s ease-in-out infinite;
          box-shadow:
            0 8px 22px -4px rgba(99,102,241,0.7),
            inset 0 0 0 2px rgba(255,255,255,0.28);
        }
        .vt-bubble.vt-bubble-active .vt-bubble-ring {
          animation-duration: 1.1s;
        }

        /* Click bounce — fires for ~450ms after every click. */
        .vt-bubble.vt-bubble-clicked .vt-bubble-core {
          animation: vtBubblePunch 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes vtBubbleFloat {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50%      { transform: translate(-50%, -52%) scale(1.04); }
        }
        @keyframes vtBubbleFloatActive {
          0%, 100% { transform: translate(-50%, -50%) scale(1.18); }
          50%      { transform: translate(-50%, -52%) scale(1.26); }
        }
        @keyframes vtBubbleHue {
          0%, 100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        @keyframes vtBubbleRipple {
          0%   { opacity: 0.55; transform: translate(-50%, -50%) scale(0.7); }
          80%  { opacity: 0;    transform: translate(-50%, -50%) scale(2.4); }
          100% { opacity: 0;    transform: translate(-50%, -50%) scale(2.4); }
        }
        @keyframes vtBubblePunch {
          0%   { transform: translate(-50%, -50%) scale(1.18); }
          35%  { transform: translate(-50%, -50%) scale(0.78); }
          100% { transform: translate(-50%, -50%) scale(1.18); }
        }

        @media (prefers-reduced-motion: reduce) {
          .vt-bubble-core, .vt-bubble-ring,
          .vt-bubble.vt-bubble-active .vt-bubble-core,
          .vt-bubble.vt-bubble-clicked .vt-bubble-core {
            animation: none !important;
          }
          .vt-bubble-ring { display: none; }
        }
      `}</style>
    </>
  );
}

export default HelpFab;
