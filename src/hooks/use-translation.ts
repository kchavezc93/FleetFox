// src/hooks/use-translation.ts
"use client";

import { useContext, useState, useEffect, useCallback, useRef } from 'react';
import { I18nContext, type Language } from '@/contexts/i18n-context';
import { translateText } from '@/ai/flows/translate-text-flow';

interface UseTranslationReturn {
  t: (key: string, defaultText?: string) => string;
  language: Language;
  setLanguage: (language: Language) => void;
  languages: Language[];
  isLoading: (key: string) => boolean;
  defaultLanguage: Language;
}

export function useTranslation(): UseTranslationReturn {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }

  const { language, setLanguage, languages, defaultLanguage } = context;
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());
  const translationCache = useRef<Record<string, Record<string, string>>>({}); // { 'es': { 'Hello': 'Hola' } }

  const t = useCallback((key: string, defaultText: string = key): string => {
    if (language.code === defaultLanguage.code || !key) {
      return defaultText;
    }

    if (translationCache.current[language.code]?.[key]) {
      return translationCache.current[language.code][key];
    }
    
    if (translations[key]) {
       return translations[key];
    }


    if (loadingKeys.has(key)) {
      return `${defaultText} (${language.code})...`; // Placeholder while loading
    }

    // Trigger translation
    const currentLoadingKeys = new Set(loadingKeys);
    currentLoadingKeys.add(key);
    setLoadingKeys(currentLoadingKeys);

    translateText({ textToTranslate: defaultText, targetLanguageCode: language.code })
      .then(result => {
        setTranslations(prev => ({ ...prev, [key]: result.translatedText }));
        if (!translationCache.current[language.code]) {
            translationCache.current[language.code] = {};
        }
        translationCache.current[language.code][key] = result.translatedText;
      })
      .catch(error => {
        console.error(`Failed to translate "${key}" to ${language.code}:`, error);
        // Fallback to default text if error, and cache the fallback
        setTranslations(prev => ({ ...prev, [key]: defaultText }));
         if (!translationCache.current[language.code]) {
            translationCache.current[language.code] = {};
        }
        translationCache.current[language.code][key] = defaultText;
      })
      .finally(() => {
        setLoadingKeys(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      });

    return `${defaultText} (${language.code})...`; // Initial return, will re-render with translation
  }, [language, defaultLanguage.code, translations, loadingKeys]);

  useEffect(() => {
    // When language changes, if we have cached translations for the new language, use them.
    // Otherwise, clear current translations to force re-fetch or show loading.
    if (translationCache.current[language.code]) {
      setTranslations(translationCache.current[language.code]);
    } else {
      setTranslations({});
    }
    setLoadingKeys(new Set()); // Clear loading keys on language change
  }, [language]);
  
  const isLoading = (key:string) => loadingKeys.has(key);

  return { t, language, setLanguage, languages, isLoading, defaultLanguage };
}
