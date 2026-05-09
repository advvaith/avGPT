"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-7 w-7" />;
  const isDark = (theme === "system" ? resolvedTheme : theme) === "dark";
  return (
    <button
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="rounded-md p-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-fg)]"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
