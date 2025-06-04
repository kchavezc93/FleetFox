// src/contexts/i18n-context.tsx
"use client";

import type React from 'react';
import { createContext, useState, useEffect, useCallback } from 'react';

export interface Language {
  code: string;
  name: string;
}

export const defaultLanguage: Language = { code: 'en', name: 'English' };
export const supportedLanguages: Language[] = [
  defaultLanguage,
  { code: 'es', name: 'Español' },
  // Add more languages here
  // { code: 'fr', name: 'Français' },
];

interface I18nContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  languages: Language[];
  defaultLanguage: Language;
}

export const I18nContext = createContext<I18nContextType | undefined>(undefined);

interface I18nProviderProps {
  children: React.ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [language, setCurrentLanguage] = useState<Language>(() => {
    // Initializer function to read from localStorage first
    if (typeof window !== 'undefined') {
      const storedLangCode = localStorage.getItem('preferredLanguageCode');
      if (storedLangCode) {
        const foundLang = supportedLanguages.find(l => l.code === storedLangCode);
        if (foundLang) {
          return foundLang;
        }
      }
    }
    return defaultLanguage;
  });

  // Effect for syncing with localStorage changes from other tabs/sources
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'preferredLanguageCode' || event.key === 'preferredLanguageName' || event.key === null) {
        if (typeof window !== 'undefined') {
          const storedLangCode = localStorage.getItem('preferredLanguageCode');
          const currentLanguageCodeInState = language.code; // Capture current state value

          if (storedLangCode) {
            const foundLang = supportedLanguages.find(l => l.code === storedLangCode);
            if (foundLang && foundLang.code !== currentLanguageCodeInState) {
              setCurrentLanguage(foundLang);
            }
          } else if (currentLanguageCodeInState !== defaultLanguage.code) { // localStorage was cleared
            setCurrentLanguage(defaultLanguage);
          }
        }
      }
    };
    
    // Initial check in case useState initializer couldn't get localStorage or value was stale
    if (typeof window !== 'undefined') {
        const storedLangCode = localStorage.getItem('preferredLanguageCode');
        if (storedLangCode) {
            const foundLang = supportedLanguages.find(l => l.code === storedLangCode);
            if (foundLang && foundLang.code !== language.code) {
                setCurrentLanguage(foundLang);
            }
        } else if (language.code !== defaultLanguage.code) {
             setCurrentLanguage(defaultLanguage);
        }
    }


    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [language.code, defaultLanguage.code]); // Dependencies ensure re-sync if codes change by other means.

  const setLanguage = useCallback((newLanguage: Language) => {
    setCurrentLanguage(newLanguage);
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferredLanguageCode', newLanguage.code);
      localStorage.setItem('preferredLanguageName', newLanguage.name);
    }
  }, []);


  return (
    <I18nContext.Provider value={{ language, setLanguage, languages: supportedLanguages, defaultLanguage }}>
      {children}
    </I18nContext.Provider>
  );
}
