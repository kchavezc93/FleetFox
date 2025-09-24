
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

type Theme = "light" | "dark" | "system";

interface ThemeProviderState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme?: "light" | "dark";
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme", // Using a common key convention
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') {
      return defaultTheme;
    }
    try {
      const storedTheme = window.localStorage.getItem(storageKey) as Theme | null;
      return storedTheme || defaultTheme;
    } catch (e) {
      console.warn(`Failed to read theme from localStorage (key: "${storageKey}")`, e);
      return defaultTheme;
    }
  });
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>();

  const applyTheme = useCallback((selectedTheme: Theme) => {
    let currentTheme: Theme = selectedTheme;
    if (selectedTheme === "system") {
      currentTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(currentTheme);
    const resolved: "light" | "dark" = currentTheme === "dark" ? "dark" : "light";
    setResolvedTheme(resolved);
  }, []);


  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  // Listener for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        applyTheme("system");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, applyTheme]);


  const setTheme = (newTheme: Theme) => {
    try {
      window.localStorage.setItem(storageKey, newTheme);
    } catch (e) {
      console.warn(`Failed to save theme to localStorage (key: "${storageKey}")`, e);
    }
    setThemeState(newTheme);
  };

  return (
    <ThemeProviderContext.Provider value={{ theme, setTheme, resolvedTheme }} {...props}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = (): ThemeProviderState => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
