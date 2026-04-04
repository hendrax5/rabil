'use client';

import { useAppStore } from '@/lib/store';
import idTranslations from '@/locales/id.json';
import enTranslations from '@/locales/en.json';

export type Locale = 'id' | 'en';

// Type-safe translations
const translations = {
  id: idTranslations,
  en: enTranslations,
} as const;

type TranslationKeys = typeof idTranslations;

// Helper to get nested value
function getNestedValue(obj: any, path: string): string {
  const keys = path.split('.');
  let result = obj;
  
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      return path; // Return path if not found
    }
  }
  
  return typeof result === 'string' ? result : path;
}

// Translation function with interpolation
function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>
): string {
  const localeData = translations[locale] || translations.id;
  let text = getNestedValue(localeData, key);
  
  // Fallback to English if not found in current locale
  if (text === key && locale !== 'en') {
    text = getNestedValue(translations.en, key);
  }
  
  // Interpolate params
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    });
  }
  
  return text;
}

// React hook for translations
export function useTranslation() {
  const { locale, setLocale } = useAppStore();
  
  const t = (key: string, params?: Record<string, string | number>): string => {
    return translate(locale, key, params);
  };
  
  const changeLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    // Optionally save to cookie for server-side detection
    document.cookie = `locale=${newLocale};path=/;max-age=31536000`;
  };
  
  return {
    t,
    locale,
    setLocale: changeLocale,
    isID: locale === 'id',
    isEN: locale === 'en',
  };
}

// Non-hook version for use outside React components
export function getTranslation(locale: Locale) {
  return {
    t: (key: string, params?: Record<string, string | number>) => 
      translate(locale, key, params),
  };
}

// Export raw translations for direct access
export { translations };

// Type helpers
export type TranslationKey = keyof TranslationKeys['common'] 
  | keyof TranslationKeys['auth']
  | keyof TranslationKeys['nav']
  | keyof TranslationKeys['dashboard']
  | keyof TranslationKeys['pppoe']
  | keyof TranslationKeys['hotspot']
  | keyof TranslationKeys['invoices']
  | keyof TranslationKeys['keuangan']
  | keyof TranslationKeys['sessions']
  | keyof TranslationKeys['whatsapp']
  | keyof TranslationKeys['network']
  | keyof TranslationKeys['settings']
  | keyof TranslationKeys['management']
  | keyof TranslationKeys['notifications']
  | keyof TranslationKeys['errors']
  | keyof TranslationKeys['table']
  | keyof TranslationKeys['time']
  | keyof TranslationKeys['system'];
