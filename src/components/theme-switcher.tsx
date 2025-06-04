
"use client";

import React from "react"; // Added missing import
import { useTheme } from "@/contexts/theme-provider";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Laptop } from "lucide-react";

export function ThemeSwitcher() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Ensure component only renders on the client where localStorage and window are available
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Or a skeleton loader
    return (
        <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" disabled className="w-24 justify-start opacity-50">
                <Sun className="mr-2 h-4 w-4" /> Claro
            </Button>
            <Button variant="outline" size="sm" disabled className="w-24 justify-start opacity-50">
                <Moon className="mr-2 h-4 w-4" /> Oscuro
            </Button>
            <Button variant="outline" size="sm" disabled className="w-28 justify-start opacity-50">
                <Laptop className="mr-2 h-4 w-4" /> Sistema
            </Button>
        </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <Button
        variant={resolvedTheme === "light" && theme !== "system" || (theme === "system" && resolvedTheme === "light") ? "default" : "outline"}
        size="sm"
        onClick={() => setTheme("light")}
        className="w-24 justify-start"
      >
        <Sun className="mr-2 h-4 w-4" />
        Claro
      </Button>
      <Button
        variant={resolvedTheme === "dark" && theme !== "system" || (theme === "system" && resolvedTheme === "dark") ? "default" : "outline"}
        size="sm"
        onClick={() => setTheme("dark")}
        className="w-24 justify-start"
      >
        <Moon className="mr-2 h-4 w-4" />
        Oscuro
      </Button>
      <Button
        variant={theme === "system" ? "default" : "outline"}
        size="sm"
        onClick={() => setTheme("system")}
        className="w-28 justify-start"
      >
        <Laptop className="mr-2 h-4 w-4" />
        Sistema
      </Button>
    </div>
  );
}
