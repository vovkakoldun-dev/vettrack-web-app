import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageSquare, Bell, X } from 'lucide-react';
import { useNavigate } from 'react-router';

interface Toast {
  id: number;
  type: 'chat' | 'notification';
  title: string;
  message: string;
  link?: string;
}

let toastId = 0;

// ─── Sound: soft, short cues for new toasts ─────────────────────────────────
// Generated with the Web Audio API — no external audio files needed.
// Respects browser autoplay policy: only plays after a user interaction.
let audioCtx: AudioContext | null = null;

type SoundNote = { freq: number; start: number; duration: number };

function playTone(notes: SoundNote[], type: OscillatorType = 'sine', peakGain = 0.12) {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') { audioCtx.resume().catch(() => {}); }
    const ctx = audioCtx;
    const now = ctx.currentTime;

    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = n.freq;
      // Quick attack, exponential decay — feels natural and unobtrusive
      gain.gain.setValueAtTime(0.0001, now + n.start);
      gain.gain.exponentialRampToValueAtTime(peakGain, now + n.start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + n.start);
      osc.stop(now + n.start + n.duration + 0.02);
    }
  } catch {
    // Silently ignore — audio is a nice-to-have, never block the toast
  }
}

// Chat message — ascending two-note sine "chirp" (A5 → E6), ~160ms
function playMessageSound() {
  playTone([
    { freq: 880,  start: 0,     duration: 0.09 },  // A5
    { freq: 1320, start: 0.07,  duration: 0.10 },  // E6
  ], 'sine', 0.12);
}

// Notification — descending two-note triangle "chime" (E5 → C5), ~220ms
// Triangle wave + descending pattern = warmer, more "attention" feel,
// clearly distinct from the chat chirp.
function playNotificationSound() {
  playTone([
    { freq: 659.25, start: 0,     duration: 0.14 },  // E5
    { freq: 523.25, start: 0.12,  duration: 0.16 },  // C5
  ], 'triangle', 0.11);
}

/** Dispatch from anywhere to show a toast */
export function showToast(detail: { type: 'chat' | 'notification'; title: string; message: string; link?: string }) {
  window.dispatchEvent(new CustomEvent('showToast', { detail }));
}

export default function ToastNotification() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const navigate = useNavigate();
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) { clearTimeout(timer); timersRef.current.delete(id); }
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      const id = ++toastId;
      const toast: Toast = { id, ...detail };
      setToasts((prev) => [...prev.slice(-2), toast]); // max 3
      // Play a soft short cue — different tone for chat vs notification toasts
      if (detail.type === 'chat') playMessageSound();
      else if (detail.type === 'notification') playNotificationSound();
      const timer = setTimeout(() => removeToast(id), 5000);
      timersRef.current.set(id, timer);
    };
    window.addEventListener('showToast', handler);
    return () => window.removeEventListener('showToast', handler);
  }, [removeToast]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => { timersRef.current.forEach((t) => clearTimeout(t)); };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: '10px', pointerEvents: 'none',
    }}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            pointerEvents: 'auto',
            display: 'flex', alignItems: 'flex-start', gap: '12px',
            padding: '14px 16px', borderRadius: '12px',
            background: 'var(--surface-white, #fff)',
            border: '1px solid var(--border-color, #e2e8f0)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
            maxWidth: '360px', minWidth: '280px',
            cursor: toast.link ? 'pointer' : 'default',
            animation: 'toastSlideIn 0.3s ease-out',
          }}
          onClick={() => {
            if (toast.link) { navigate(toast.link); removeToast(toast.id); }
          }}
        >
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: toast.type === 'chat' ? '#3B82F615' : 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)',
            color: toast.type === 'chat' ? '#3B82F6' : 'var(--brand-green-text)',
          }}>
            {toast.type === 'chat' ? <MessageSquare size={18} /> : <Bell size={18} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #0f172a)', marginBottom: '2px' }}>
              {toast.title}
            </div>
            <div style={{
              fontSize: '12px', color: 'var(--text-secondary, #64748b)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {toast.message}
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); removeToast(toast.id); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
              color: 'var(--text-secondary, #94a3b8)', flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
