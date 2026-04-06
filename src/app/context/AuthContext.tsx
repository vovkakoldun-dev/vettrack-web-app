import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { clearProfileCache } from '../hooks/useProfile';
import { clearOrgContextCache } from '../hooks/useOrgContext';
import type { Session, User } from '@supabase/supabase-js';

const TIMEOUT_MAP: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '8h': 8 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
};

// ─── Types ─────────────────────────────────────────────────────
interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  signUp: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
  signOut: async () => {},
});

// ─── Provider ──────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Get the current session on mount
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    // 2. Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        setLoading(false);
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  // ── Auto-logout on idle ──────────────────────────────────────
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutMsRef = useRef<number | null>(null);

  // Load timeout setting once when user logs in
  useEffect(() => {
    if (!user) { timeoutMsRef.current = null; return; }
    supabase
      .from('organization_settings')
      .select('value')
      .eq('key', 'session_timeout')
      .single()
      .then(({ data }) => {
        const val = data?.value || '8h';
        timeoutMsRef.current = TIMEOUT_MAP[val] ?? null;
      });
  }, [user]);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    const ms = timeoutMsRef.current;
    if (!ms) return; // 'never' or not loaded yet
    idleTimerRef.current = setTimeout(() => {
      clearProfileCache();
      clearOrgContextCache();
      supabase.auth.signOut();
    }, ms);
  }, []);

  useEffect(() => {
    if (!user) return;
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const handler = () => resetIdleTimer();
    resetIdleTimer();
    events.forEach(e => window.addEventListener(e, handler, { passive: true }));
    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [user, resetIdleTimer]);

  // ── Sign up with email/password ───────────────────────────────
  async function signUp(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }

  // ── Sign in with email/password ───────────────────────────────
  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }

  // ── Sign out ──────────────────────────────────────────────────
  async function signOut() {
    // Clear all cached identity / org state
    clearProfileCache();
    clearOrgContextCache();
    // Clear any sessionStorage keys that may hold org/portal state
    try {
      sessionStorage.clear();
    } catch { /* SSR / restricted environments */ }
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────
export function useAuth() {
  return useContext(AuthContext);
}
