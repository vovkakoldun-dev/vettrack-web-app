import { useState, useEffect, useCallback } from 'react';

/**
 * Visual theme styles available in the app.
 *
 * Adding a new style:
 *   1. Add a CSS block in theme.css  (e.g. .theme-newname { ... })
 *   2. Add the key to ThemeStyle union
 *   3. Add metadata to THEME_STYLES below
 *   4. Add class mapping in getThemeClassesForStyle()
 */
export type ThemeStyle =
  | 'light'
  | 'dark'
  | 'glass'
  | 'pastel'
  | 'contrast'
  | 'midnight'
  | 'sage'
  | 'sand';

export interface ThemeStyleMeta {
  value: ThemeStyle;
  label: string;
  description: string;
  preview: string;
  isDarkBase: boolean;
}

export const THEME_STYLES: ThemeStyleMeta[] = [
  /* ── Light themes ─── */
  {
    value: 'light',
    label: 'Light',
    description: 'Clean, minimal light interface',
    preview: '#F8F7F4',
    isDarkBase: false,
  },
  {
    value: 'pastel',
    label: 'Pastel',
    description: 'Warm, soft pastel tones',
    preview: 'linear-gradient(135deg, #FDF6F0 0%, #F5E6D3 50%, #D4727A 100%)',
    isDarkBase: false,
  },
  {
    value: 'sage',
    label: 'Sage',
    description: 'Natural, earthy green tones',
    preview: 'linear-gradient(135deg, #F0F4EF 0%, #D4E2D0 50%, #6B8F71 100%)',
    isDarkBase: false,
  },
  {
    value: 'sand',
    label: 'Sand',
    description: 'Warm golden light theme',
    preview: 'linear-gradient(135deg, #FAF6ED 0%, #E8D5B5 50%, #C49A4A 100%)',
    isDarkBase: false,
  },
  /* ── Dark themes ─── */
  {
    value: 'dark',
    label: 'Dark',
    description: 'Soft contrast dark theme',
    preview: '#0F172A',
    isDarkBase: true,
  },
  {
    value: 'midnight',
    label: 'Midnight',
    description: 'Deep blue, calm nighttime feel',
    preview: 'linear-gradient(135deg, #0D1B2A 0%, #1B2838 50%, #3B82F6 100%)',
    isDarkBase: true,
  },
  {
    value: 'glass',
    label: 'Glass',
    description: 'Frosted glassmorphism with blur',
    preview: 'linear-gradient(135deg, #0B1120 0%, rgba(99,102,241,0.3) 50%, #0B1120 100%)',
    isDarkBase: true,
  },
  {
    value: 'contrast',
    label: 'Pro',
    description: 'Maximum contrast, accessibility-first',
    preview: 'linear-gradient(135deg, #000000 0%, #0A0A0A 60%, #00FF88 100%)',
    isDarkBase: true,
  },
];

export const LIGHT_THEMES = THEME_STYLES.filter(t => !t.isDarkBase);
export const DARK_THEMES  = THEME_STYLES.filter(t => t.isDarkBase);

const STORAGE_KEY_PREFIX = 'vettrack-theme';
const ALL_THEME_CLASSES = [
  'dark', 'theme-glass', 'theme-pastel', 'theme-contrast',
  'theme-midnight', 'theme-sage', 'theme-sand',
];

/** Derive portal from current URL path for per-portal theme storage */
function getPortalKey(): string {
  if (typeof window === 'undefined') return STORAGE_KEY_PREFIX;
  const path = window.location.pathname;
  if (path.startsWith('/superadmin')) return `${STORAGE_KEY_PREFIX}-superadmin`;
  if (path.startsWith('/admin')) return `${STORAGE_KEY_PREFIX}-admin`;
  if (path.startsWith('/owner')) return `${STORAGE_KEY_PREFIX}-owner`;
  return STORAGE_KEY_PREFIX; // doctor portal (default)
}

function getThemeClassesForStyle(style: ThemeStyle): string[] {
  switch (style) {
    case 'light':    return [];
    case 'dark':     return ['dark'];
    case 'glass':    return ['dark', 'theme-glass'];
    case 'pastel':   return ['theme-pastel'];
    case 'contrast': return ['dark', 'theme-contrast'];
    case 'midnight': return ['dark', 'theme-midnight'];
    case 'sage':     return ['theme-sage'];
    case 'sand':     return ['theme-sand'];
    default:         return [];
  }
}

function resolveIsDark(style: ThemeStyle): boolean {
  const meta = THEME_STYLES.find(t => t.value === style);
  return meta?.isDarkBase ?? false;
}

function applyThemeToDOM(style: ThemeStyle) {
  const root = document.documentElement;
  ALL_THEME_CLASSES.forEach(cls => root.classList.remove(cls));
  const classes = getThemeClassesForStyle(style);
  classes.forEach(cls => root.classList.add(cls));
  root.setAttribute('data-theme', style);
}

/* ─────────────────────────────────────────────────────────────────────────
 * Storage layout (per portal):
 *   {base}-mode   → 'light' | 'dark'    (which mode is currently active)
 *   {base}-light  → ThemeStyle           (saved light-mode theme)
 *   {base}-dark   → ThemeStyle           (saved dark-mode theme)
 *
 * The sidebar toggle reads the opposite mode's saved theme and applies it.
 * ────────────────────────────────────────────────────────────────────── */

/** One-time migration from the old single-key format */
function migrateStorage(base: string) {
  if (localStorage.getItem(`${base}-mode`)) return; // already migrated

  const old = localStorage.getItem(base);
  if (!old) return;

  const meta = THEME_STYLES.find(t => t.value === old);
  if (meta) {
    const mode = meta.isDarkBase ? 'dark' : 'light';
    localStorage.setItem(`${base}-${mode}`, old);
    localStorage.setItem(`${base}-mode`, mode);
  } else if (old === 'dark' || old === 'system') {
    localStorage.setItem(`${base}-mode`, 'dark');
  } else if (old === 'light') {
    localStorage.setItem(`${base}-mode`, 'light');
  }
  localStorage.removeItem(base);
}

function readSavedStyle(base: string, mode: 'light' | 'dark'): ThemeStyle {
  const stored = localStorage.getItem(`${base}-${mode}`) as ThemeStyle | null;
  if (stored && THEME_STYLES.some(t => t.value === stored)) return stored;
  return mode === 'dark' ? 'dark' : 'light';
}

function readMode(base: string): 'light' | 'dark' {
  const m = localStorage.getItem(`${base}-mode`);
  return m === 'dark' ? 'dark' : 'light';
}

export function useTheme() {
  const storageBase = getPortalKey();

  // Run migration once
  if (typeof window !== 'undefined') migrateStorage(storageBase);

  const [themeStyle, setThemeStyleRaw] = useState<ThemeStyle>(() => {
    if (typeof window === 'undefined') return 'light';
    const mode = readMode(storageBase);
    return readSavedStyle(storageBase, mode);
  });

  const [isDark, setIsDark] = useState<boolean>(() => resolveIsDark(themeStyle));

  // Expose saved preferences for settings UI
  const [savedLight, setSavedLight] = useState<ThemeStyle>(() =>
    typeof window !== 'undefined' ? readSavedStyle(storageBase, 'light') : 'light',
  );
  const [savedDark, setSavedDark] = useState<ThemeStyle>(() =>
    typeof window !== 'undefined' ? readSavedStyle(storageBase, 'dark') : 'dark',
  );

  // Apply theme to DOM on mount & changes
  useEffect(() => {
    applyThemeToDOM(themeStyle);
  }, [themeStyle]);

  /** Select a theme — saves to the correct mode slot and switches to it */
  const setThemeStyle = useCallback((style: ThemeStyle) => {
    const meta = THEME_STYLES.find(t => t.value === style);
    const modeKey = meta?.isDarkBase ? 'dark' : 'light';

    localStorage.setItem(`${storageBase}-${modeKey}`, style);
    localStorage.setItem(`${storageBase}-mode`, modeKey);

    if (modeKey === 'light') setSavedLight(style); else setSavedDark(style);
    setThemeStyleRaw(style);
    setIsDark(meta?.isDarkBase ?? false);
    applyThemeToDOM(style);

    window.dispatchEvent(
      new StorageEvent('storage', { key: `${storageBase}-mode`, newValue: modeKey }),
    );
  }, [storageBase]);

  /** Toggle between saved light and dark themes */
  const toggle = useCallback(() => {
    const newMode = isDark ? 'light' : 'dark';
    const targetStyle = readSavedStyle(storageBase, newMode);

    localStorage.setItem(`${storageBase}-mode`, newMode);
    setThemeStyleRaw(targetStyle);
    setIsDark(resolveIsDark(targetStyle));
    applyThemeToDOM(targetStyle);
  }, [isDark, storageBase]);

  // Cross-tab / cross-component sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key?.startsWith(storageBase)) return;
      const mode = readMode(storageBase);
      const style = readSavedStyle(storageBase, mode);
      setThemeStyleRaw(style);
      setIsDark(resolveIsDark(style));
      setSavedLight(readSavedStyle(storageBase, 'light'));
      setSavedDark(readSavedStyle(storageBase, 'dark'));
      applyThemeToDOM(style);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storageBase]);

  return {
    isDark,
    toggle,
    themeStyle,
    setThemeStyle,
    /** The light theme saved for this portal (for settings highlight) */
    selectedLightTheme: savedLight,
    /** The dark theme saved for this portal (for settings highlight) */
    selectedDarkTheme: savedDark,
  };
}
