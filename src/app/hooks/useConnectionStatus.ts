import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';

export type ConnectionState = 'connected' | 'disconnected' | 'reconnecting';

export interface ConnectionStatus {
  state: ConnectionState;
  lastSyncAt: Date | null;
  /** Human-readable label, e.g. "just now", "2m ago", "Offline" */
  label: string;
  /** Manually trigger a connectivity check + data refresh */
  refresh: () => void;
}

/**
 * Monitors real Supabase connectivity.
 *
 * Strategy:
 *  1. `navigator.onLine` for instant offline detection.
 *  2. Lightweight Supabase ping (`SELECT 1`) every 30s to verify the backend.
 *  3. On failure → state moves to 'disconnected'; retries every 10s.
 *  4. Exposes a human-readable `label` that auto-updates every 15s.
 */
export function useConnectionStatus(): ConnectionStatus {
  const [state, setState] = useState<ConnectionState>(
    navigator.onLine ? 'connected' : 'disconnected',
  );
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [label, setLabel] = useState('Checking…');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const labelRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Ping Supabase ─────────────────────────────────────────────
  const ping = useCallback(async (): Promise<boolean> => {
    if (!navigator.onLine) return false;
    try {
      // Tiny RPC-free query — just checks connectivity
      const { error } = await supabase.from('organizations').select('id', { count: 'exact', head: true });
      return !error;
    } catch {
      return false;
    }
  }, []);

  // ── Run a sync check ──────────────────────────────────────────
  const check = useCallback(async () => {
    const ok = await ping();
    if (ok) {
      setState('connected');
      setLastSyncAt(new Date());
    } else {
      setState((prev) => (prev === 'connected' ? 'disconnected' : prev));
    }
  }, [ping]);

  // ── Public refresh ────────────────────────────────────────────
  const refresh = useCallback(() => {
    setState('reconnecting');
    check();
  }, [check]);

  // ── Initial check + polling ───────────────────────────────────
  useEffect(() => {
    // First check immediately
    check();

    // Poll every 30s when connected
    intervalRef.current = setInterval(() => {
      check();
    }, 30_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [check]);

  // ── Retry loop when disconnected ──────────────────────────────
  useEffect(() => {
    if (retryRef.current) {
      clearInterval(retryRef.current);
      retryRef.current = null;
    }

    if (state === 'disconnected') {
      retryRef.current = setInterval(() => {
        setState('reconnecting');
        check();
      }, 10_000);
    }

    return () => {
      if (retryRef.current) clearInterval(retryRef.current);
    };
  }, [state, check]);

  // ── Browser online/offline events ─────────────────────────────
  useEffect(() => {
    const handleOnline = () => {
      setState('reconnecting');
      check();
    };
    const handleOffline = () => setState('disconnected');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [check]);

  // ── Label updater (runs every 15s) ────────────────────────────
  const computeLabel = useCallback(() => {
    if (state === 'disconnected') return 'Offline';
    if (state === 'reconnecting') return 'Reconnecting…';
    if (!lastSyncAt) return 'Checking…';

    const diffSec = Math.floor((Date.now() - lastSyncAt.getTime()) / 1000);
    if (diffSec < 10) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    return `${diffHr}h ago`;
  }, [state, lastSyncAt]);

  useEffect(() => {
    setLabel(computeLabel());
    labelRef.current = setInterval(() => setLabel(computeLabel()), 15_000);
    return () => {
      if (labelRef.current) clearInterval(labelRef.current);
    };
  }, [computeLabel]);

  return { state, lastSyncAt, label, refresh };
}
