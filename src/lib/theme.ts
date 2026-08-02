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
  { id: "mono", name: "Mono", primary: "0.97 0 0", primaryForeground: "0.14 0 0" },
  { id: "acid", name: "Acid", primary: "0.88 0.24 130", primaryForeground: "0.14 0.02 130" },
  { id: "matrix", name: "Matrix", primary: "0.80 0.22 145", primaryForeground: "0.12 0.03 145" },
  { id: "gold", name: "Gold", primary: "0.84 0.13 92", primaryForeground: "0.17 0.03 92" },
  { id: "ice", name: "Ice", primary: "0.90 0.05 215", primaryForeground: "0.16 0.02 215" },
  { id: "plum", name: "Plum", primary: "0.62 0.16 320", primaryForeground: "0.98 0.005 320" },
  { id: "sand", name: "Sand", primary: "0.86 0.06 80", primaryForeground: "0.20 0.02 80" },
  { id: "crimson", name: "Crimson", primary: "0.60 0.22 25", primaryForeground: "0.98 0.005 25" },
];

/** Background / surface styles — control the canvas, cards and glass tokens. */
export type SurfacePreset = {
  id: string;
  name: string;
  hint: string;
  swatch: string;
  vars: Record<string, string>;
};

export const SURFACE_PRESETS: SurfacePreset[] = [
  {
    id: "space",
    name: "Deep space",
    hint: "Default cool navy canvas",
    swatch: "oklch(0.13 0.012 265)",
    vars: {},
  },
  {
    id: "onyx",
    name: "Onyx",
    hint: "True black, OLED friendly",
    swatch: "oklch(0 0 0)",
    vars: {
      "--background": "oklch(0 0 0)",
      "--card": "oklch(0.13 0 0)",
      "--popover": "oklch(0.14 0 0)",
      "--secondary": "oklch(0.16 0 0)",
      "--muted": "oklch(0.16 0 0)",
      "--muted-foreground": "oklch(0.66 0 0)",
      "--accent": "oklch(0.20 0 0)",
      "--border": "oklch(0.22 0 0)",
      "--input": "oklch(0.16 0 0)",
      "--sidebar": "oklch(0.04 0 0)",
      "--sidebar-accent": "oklch(0.16 0 0)",
      "--sidebar-border": "oklch(0.20 0 0)",
      "--glass-bg": "oklch(1 0 0 / 0.045)",
      "--glass-strong": "oklch(1 0 0 / 0.08)",
      "--glass-border": "oklch(1 0 0 / 0.10)",
    },
  },
  {
    id: "translucent",
    name: "Translucent",
    hint: "Heavier frosted glass",
    swatch: "oklch(0.22 0.02 265 / 0.7)",
    vars: {
      "--background": "oklch(0.11 0.014 265)",
      "--card": "oklch(0.20 0.016 265)",
      "--glass-bg": "oklch(1 0 0 / 0.10)",
      "--glass-strong": "oklch(1 0 0 / 0.16)",
      "--glass-border": "oklch(1 0 0 / 0.20)",
      "--glass-blur": "32px",
    },
  },
  {
    id: "graphite",
    name: "Graphite",
    hint: "Neutral grey, zero tint",
    swatch: "oklch(0.20 0 0)",
    vars: {
      "--background": "oklch(0.16 0 0)",
      "--card": "oklch(0.22 0 0)",
      "--popover": "oklch(0.23 0 0)",
      "--secondary": "oklch(0.25 0 0)",
      "--muted": "oklch(0.25 0 0)",
      "--muted-foreground": "oklch(0.70 0 0)",
      "--accent": "oklch(0.30 0 0)",
      "--border": "oklch(0.30 0 0)",
      "--input": "oklch(0.25 0 0)",
      "--sidebar": "oklch(0.18 0 0)",
      "--sidebar-accent": "oklch(0.26 0 0)",
      "--sidebar-border": "oklch(0.28 0 0)",
    },
  },
  {
    id: "terminal",
    name: "Terminal",
    hint: "Black canvas, green glow",
    swatch: "oklch(0.30 0.14 145)",
    vars: {
      "--background": "oklch(0.05 0.02 150)",
      "--foreground": "oklch(0.92 0.10 145)",
      "--card": "oklch(0.12 0.03 150)",
      "--popover": "oklch(0.13 0.03 150)",
      "--secondary": "oklch(0.16 0.04 150)",
      "--muted": "oklch(0.16 0.04 150)",
      "--muted-foreground": "oklch(0.68 0.10 145)",
      "--accent": "oklch(0.22 0.06 150)",
      "--accent-foreground": "oklch(0.92 0.10 145)",
      "--border": "oklch(0.28 0.07 150)",
      "--input": "oklch(0.16 0.04 150)",
      "--sidebar": "oklch(0.07 0.02 150)",
      "--sidebar-foreground": "oklch(0.90 0.09 145)",
      "--sidebar-accent": "oklch(0.18 0.05 150)",
      "--sidebar-border": "oklch(0.26 0.06 150)",
      "--glass-bg": "oklch(0.80 0.20 145 / 0.06)",
      "--glass-strong": "oklch(0.80 0.20 145 / 0.10)",
      "--glass-border": "oklch(0.80 0.20 145 / 0.20)",
    },
  },
  {
    id: "paper",
    name: "Paper",
    hint: "Warm off-white surfaces",
    swatch: "oklch(0.95 0.012 80)",
    vars: {
      "--background": "oklch(0.20 0.008 80)",
      "--card": "oklch(0.26 0.010 80)",
      "--popover": "oklch(0.27 0.010 80)",
      "--secondary": "oklch(0.29 0.010 80)",
      "--muted": "oklch(0.29 0.010 80)",
      "--muted-foreground": "oklch(0.74 0.012 80)",
      "--accent": "oklch(0.33 0.012 80)",
      "--border": "oklch(0.34 0.012 80)",
      "--input": "oklch(0.29 0.010 80)",
      "--sidebar": "oklch(0.23 0.008 80)",
      "--sidebar-accent": "oklch(0.30 0.010 80)",
      "--sidebar-border": "oklch(0.33 0.012 80)",
    },
  },
];

const SURFACE_VAR_KEYS = Array.from(
  new Set(SURFACE_PRESETS.flatMap((s) => Object.keys(s.vars))),
);

export type Mode = "dark" | "light" | "system";
export type Density = "cozy" | "compact";

export type ThemeSettings = {
  accent: string;
  surface: string;
  mode: Mode;
  fontScale: number; // 0.9 – 1.2
  glass: boolean;
  density: Density;
  enterToSend: boolean;
};

export const DEFAULT_SETTINGS: ThemeSettings = {
  accent: "mono",
  surface: "onyx",

  mode: "dark",
  fontScale: 1,
  glass: true,
  density: "cozy",
  enterToSend: false,
};

const KEY = "rave.settings.v2";

export function getSurface(id: string): SurfacePreset {
  return SURFACE_PRESETS.find((s) => s.id === id) ?? SURFACE_PRESETS[0];
}


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

  // Surface style (dark canvases only — light mode keeps its own palette)
  for (const key of SURFACE_VAR_KEYS) root.style.removeProperty(key);
  if (!light) {
    const surface = getSurface(s.surface);
    for (const [key, value] of Object.entries(surface.vars)) {
      root.style.setProperty(key, value);
    }
  }

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
