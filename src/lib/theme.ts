// Theme accent-color customization. Stored in localStorage and applied to
// the document root as CSS custom properties.

export type ThemePreset = {
  id: string;
  name: string;
  // oklch strings (e.g. "0.82 0.14 78")
  primary: string;
  primaryForeground: string;
};

export const THEME_PRESETS: ThemePreset[] = [
  { id: "amber", name: "Amber", primary: "0.82 0.14 78", primaryForeground: "0.18 0.02 60" },
  { id: "emerald", name: "Emerald", primary: "0.75 0.16 155", primaryForeground: "0.15 0.02 155" },
  { id: "sky", name: "Sky", primary: "0.72 0.14 235", primaryForeground: "0.98 0.005 235" },
  { id: "rose", name: "Rose", primary: "0.72 0.19 15", primaryForeground: "0.98 0.005 15" },
  { id: "violet", name: "Violet", primary: "0.68 0.19 295", primaryForeground: "0.98 0.005 295" },
  { id: "lime", name: "Lime", primary: "0.85 0.19 128", primaryForeground: "0.18 0.02 128" },
];

const KEY = "rave.theme";

export function applyTheme(preset: ThemePreset) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--primary", `oklch(${preset.primary})`);
  root.style.setProperty("--ring", `oklch(${preset.primary})`);
  root.style.setProperty("--primary-foreground", `oklch(${preset.primaryForeground})`);
}

export function loadTheme(): ThemePreset {
  if (typeof window === "undefined") return THEME_PRESETS[0];
  try {
    const id = window.localStorage.getItem(KEY);
    return THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0];
  } catch {
    return THEME_PRESETS[0];
  }
}

export function saveTheme(preset: ThemePreset) {
  try {
    window.localStorage.setItem(KEY, preset.id);
  } catch {
    /* ignore */
  }
  applyTheme(preset);
}
