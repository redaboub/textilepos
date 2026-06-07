'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { translations, type Lang, type TranslationKey } from './translations';
import { createClient } from '@/lib/supabase/client';

interface I18nContextValue {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  t: (key: TranslationKey) => string;
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'textilepos_lang';

export function I18nProvider({
  children,
  initialLang = 'ar',
  userId,
}: {
  children: React.ReactNode;
  initialLang?: Lang;
  userId?: string | null;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  // Au montage : lire la préférence locale si présente (fallback rapide)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (stored === 'fr' || stored === 'ar') {
        setLangState(stored);
      }
    }
  }, []);

  // Appliquer dir + lang sur <html> à chaque changement
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const html = document.documentElement;
      html.lang = lang;
      html.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
    // Persister dans le profil (par utilisateur)
    if (userId) {
      const supabase = createClient();
      supabase.from('profiles').update({ language: next }).eq('id', userId).then(() => {});
    }
  }, [userId]);

  const t = useCallback(
    (key: TranslationKey) => {
      const entry = translations[key];
      if (!entry) return key;
      return entry[lang] ?? entry.fr ?? key;
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, dir: lang === 'ar' ? 'rtl' : 'ltr', t, setLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback safe si appelé hors provider (évite un crash)
    return {
      lang: 'ar' as Lang,
      dir: 'rtl' as const,
      t: (key: TranslationKey) => (translations[key]?.ar ?? key),
      setLang: () => {},
    };
  }
  return ctx;
}

// Raccourci pratique
export function useT() {
  return useI18n().t;
}
