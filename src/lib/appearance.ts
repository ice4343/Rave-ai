// Per-account appearance sync: the signed-in user's theme choices live on their
// profile row so they follow the account across devices/sessions.
// The login page is never affected — it always uses DEFAULT_SETTINGS.
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_SETTINGS,
  applySettings,
  loadSettings,
  saveSettings,
  type ThemeSettings,
} from "@/lib/theme";

function sanitize(raw: unknown): ThemeSettings | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<ThemeSettings>;
  return {
    ...DEFAULT_SETTINGS,
    ...(typeof r.accent === "string" ? { accent: r.accent } : {}),
    ...(typeof r.surface === "string" ? { surface: r.surface } : {}),
    ...(r.mode === "dark" || r.mode === "light" || r.mode === "system" ? { mode: r.mode } : {}),
    ...(typeof r.fontScale === "number" ? { fontScale: r.fontScale } : {}),
    ...(typeof r.glass === "boolean" ? { glass: r.glass } : {}),
    ...(r.density === "cozy" || r.density === "compact" ? { density: r.density } : {}),
    ...(typeof r.enterToSend === "boolean" ? { enterToSend: r.enterToSend } : {}),
  };
}

/** Pull the account's saved appearance and apply it. Falls back to local. */
export async function pullAppearance(): Promise<ThemeSettings> {
  const local = loadSettings();
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return local;
    const { data, error } = await supabase
      .from("profiles")
      .select("appearance")
      .eq("id", uid)
      .maybeSingle();
    if (error || !data) return local;
    const remote = sanitize(data.appearance);
    if (!remote) {
      // First run for this account: seed the account with what's on device.
      void pushAppearance(local);
      return local;
    }
    saveSettings(remote);
    return remote;
  } catch {
    applySettings(local);
    return local;
  }
}

/** Persist the appearance on the signed-in user's account. */
export async function pushAppearance(s: ThemeSettings) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;
    await supabase.from("profiles").update({ appearance: s }).eq("id", uid);
  } catch {
    /* appearance stays in localStorage; retried on next change */
  }
}
