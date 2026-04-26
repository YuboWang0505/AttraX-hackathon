import { useStore } from "../store.js";
import { STRINGS, type Lang, type StringKey } from "./strings.js";

/**
 * Detects the initial language from localStorage > browser navigator > zh.
 * Called once at app start (before zustand store initializes); the resolved
 * value seeds the store. Subsequent setLanguage() persists to localStorage.
 */
export function detectInitialLang(): Lang {
  if (typeof window === "undefined") return "zh";
  const stored = window.localStorage.getItem("attrax.lang");
  if (stored === "zh" || stored === "en") return stored;
  const nav = navigator.language || "";
  return nav.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function persistLang(lang: Lang): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("attrax.lang", lang);
  } catch {
    // ignore quota / private mode
  }
}

/**
 * React hook returning a translation function bound to the current language
 * in the store. Re-renders when the user toggles language.
 *
 * Usage: const t = useT(); t("login.btn.create")
 */
export function useT(): (key: StringKey) => string {
  const lang = useStore((s) => s.language);
  return (key) => STRINGS[lang][key] ?? STRINGS.zh[key] ?? key;
}

/** Non-hook variant for use outside components (e.g. error messages from libs). */
export function t(key: StringKey, lang: Lang): string {
  return STRINGS[lang][key] ?? STRINGS.zh[key] ?? key;
}
