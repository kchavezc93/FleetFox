// src/components/language-selector.tsx
"use client";

import { useTranslation } from "@/hooks/use-translation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe } from "lucide-react";

export function LanguageSelector() {
  const { language, setLanguage, languages, defaultLanguage } = useTranslation();

  const handleLanguageChange = (langCode: string) => {
    const selectedLang = languages.find(l => l.code === langCode);
    if (selectedLang) {
      setLanguage(selectedLang);
    }
  };

  // If languages array is not available or context is not ready, don't render.
  // Ensure there's at least one language to select from (usually default + others).
  if (!languages || languages.length === 0 || !language || !language.code) {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      <Globe className="h-5 w-5 text-muted-foreground group-data-[collapsible=icon]:hidden" />
      <Select value={language.code} onValueChange={handleLanguageChange}>
        <SelectTrigger className="w-auto h-9 border-none focus:ring-0 shadow-none bg-transparent px-2 group-data-[collapsible=icon]:hidden">
          <SelectValue placeholder={language.name || defaultLanguage?.name || "Language"} />
        </SelectTrigger>
        <SelectContent align="end">
          {languages.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              {lang.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
