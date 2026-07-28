// Theme customization: accent color, light/dark mode, text size, glass intensity.
// Persisted in localStorage and applied to the document root.

export type ThemePreset = {
  id: string;
  name: string;
  // oklch components (e.g. "0.82 0.14 78")
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
  { id: "cyan", name: "Cyan", primary: "0.78 0.13 200", primaryForeground: "0.16 0.02 200" },
  { id: "coral", name: "Coral", primary: "0.76 0.16 40", primaryForeground: "0.18 0.02 40" },
  { id: "indigo", name: "Indigo", primary: "0.63 0.18 275", primaryForeground: "0.98 0.005 275" },
  { id: "magenta", name: "Magenta", primary: "0.70 0.22 330", primaryForeground: "0.98 0.005 330" },
  { id: "teal", name: "Teal", primary: "0.74 0.12 180", primaryForeground: "0.16 0.02 180" },
  { id: "slate", name: "Slate", primary: "0.80 0.02 260", primaryForeground: "0.18 0.01 260" },
];

export type Mode = "dark" | "light" | "system";
export type Density = "cozy" | "compact";

export type ThemeSettings = {
  accent: string;
  mode: Mode;
  fontScale: number; // 0.9 – 1.2
  glass: boolean;
  density: Density;
  enterToSend: boolean;
};

export const DEFAULT_SETTINGS: ThemeSettings = {
  accent: "amber",
  mode: "dark",
  fontScale: 1,
  glass: true,
  density: "cozy",
  enterToSend: false,
};

const KEY = "rave.settings.v2";

export function getPreset(id: string): ThemePreset {
  return THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0];
}

function prefersLight() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ?? false;
}

export function applySettings(s: ThemeSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const preset = getPreset(s.accent);
  root.style.setProperty("--primary", `oklch(${preset.primary})`);
  root.style.setProperty("--ring", `oklch(${preset.primary})`);
  root.style.setProperty("--primary-foreground", `oklch(${preset.primaryForeground})`);
  root.style.setProperty("--accent-raw", preset.primary);

  const light = s.mode === "light" || (s.mode === "system" && prefersLight());
  root.classList.toggle("light", light);
  root.style.fontSize = `${Math.round(16 * s.fontScale)}px`;
  root.classList.toggle("no-glass", !s.glass);
  root.dataset.density = s.density;
}

export function loadSettings(): ThemeSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<ThemeSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: ThemeSettings) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
  applySettings(s);
}
