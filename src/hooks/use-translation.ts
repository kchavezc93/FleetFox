// src/hooks/use-translation.ts
"use client";

import { useContext, useState, useEffect, useCallback, useRef } from 'react';
import { I18nContext, type Language } from '@/contexts/i18n-context';

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
  // Non-AI pass-through translator: returns the provided defaultText.
  // If in the future you add static dictionaries, you can extend this function
  // to lookup translations without calling any AI services.
  const t = useCallback((key: string, defaultText: string = key): string => {
    return defaultText;
  }, []);

  const isLoading = (_key: string) => false;

  return { t, language, setLanguage, languages, isLoading, defaultLanguage };
}
