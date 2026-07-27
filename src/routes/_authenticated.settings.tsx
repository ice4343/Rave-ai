import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Check, Loader2, LogOut, Palette, Save, Sparkles, Trash2, User } from "lucide-react";
import { THEME_PRESETS, loadTheme, saveTheme, type ThemePreset } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Rave.ai — Settings" },
      { name: "description", content: "Shape Rave.ai's personality, name, and theme." },
    ],
  }),
  component: Settings,
});

const PRESETS = [
  { name: "Friendly", text: "You are a helpful, friendly, and concise AI assistant." },
  { name: "Blunt expert", text: "You are a blunt, no-nonsense expert. Give direct answers with confidence. Skip filler and pleasantries." },
  { name: "Playful pal", text: "You are a playful, witty companion. Use light humor, gentle emojis when it fits, and keep the vibe warm." },
  { name: "Socratic tutor", text: "You are a Socratic tutor. Guide the user to answers by asking thoughtful questions. Explain step by step." },
];

function Settings() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [theme, setThemeState] = useState<ThemePreset>(() => THEME_PRESETS[0]);

  useEffect(() => {
    setThemeState(loadTheme());
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("profiles")
        .select("personality, display_name")
        .eq("id", user.user.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data?.personality) setText(data.personality);
    if (data?.display_name) setName(data.display_name);
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;
      const { error } = await supabase
        .from("profiles")
        .update({ personality: text, display_name: name.trim() || null })
        .eq("id", user.user.id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const clearAll = async () => {
    setClearing(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;
      await supabase.from("messages").delete().eq("user_id", user.user.id);
      await supabase.from("threads").delete().eq("user_id", user.user.id);
      qc.setQueryData(["threads"], []);
      qc.invalidateQueries({ queryKey: ["threads"] });
      setConfirmClear(false);
      navigate({ to: "/chat" });
    } finally {
      setClearing(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/" });
  };

  const pickTheme = (p: ThemePreset) => {
    setThemeState(p);
    saveTheme(p);
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scroll overscroll-contain">
      <div className="max-w-xl mx-auto px-4 py-5 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        <Link to="/chat" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground mb-5">
          <ArrowLeft className="h-4 w-4" /> Back to chat
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight mb-6">Settings</h1>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Your name */}
            <section className="mb-8">
              <SectionTitle icon={<User className="h-4 w-4 text-primary" />} label="Your name" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What should Rave.ai call you?"
                className="w-full rounded-xl border border-border bg-card px-4 py-3.5 text-base outline-none focus:ring-2 focus:ring-ring/50"
              />
            </section>

            {/* Personality */}
            <section className="mb-8">
              <SectionTitle icon={<Sparkles className="h-4 w-4 text-primary" />} label="Personality" />
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring/50 resize-y"
                placeholder="Describe how Rave.ai should behave…"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => setText(p.text)}
                    className="text-xs rounded-full border border-border bg-card px-3 py-2 active:bg-accent transition"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </section>

            <button
              onClick={save}
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-3.5 text-sm font-medium active:scale-[0.99] transition disabled:opacity-60 mb-10"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </button>

            {/* Theme */}
            <section className="mb-10">
              <SectionTitle icon={<Palette className="h-4 w-4 text-primary" />} label="Accent color" />
              <div className="grid grid-cols-3 gap-3">
                {THEME_PRESETS.map((p) => {
                  const active = theme.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => pickTheme(p)}
                      className={`relative rounded-xl border p-3 flex flex-col items-center gap-2 transition ${
                        active ? "border-primary bg-primary/5" : "border-border bg-card"
                      }`}
                      aria-label={`Use ${p.name} theme`}
                    >
                      <span className="h-8 w-8 rounded-full" style={{ background: `oklch(${p.primary})` }} />
                      <span className="text-xs">{p.name}</span>
                      {active && <Check className="absolute top-1.5 right-1.5 h-3.5 w-3.5 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Danger zone */}
            <section className="space-y-3">
              {confirmClear ? (
                <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
                  <p className="text-sm mb-3">Delete every chat and message? This can't be undone.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={clearAll}
                      disabled={clearing}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-destructive text-destructive-foreground py-3 text-sm font-medium disabled:opacity-60"
                    >
                      {clearing && <Loader2 className="h-4 w-4 animate-spin" />} Delete all
                    </button>
                    <button
                      onClick={() => setConfirmClear(false)}
                      className="flex-1 rounded-lg border border-border py-3 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-destructive/40 text-destructive px-4 py-3.5 text-sm font-medium active:bg-destructive/10 transition"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete all chat history
                </button>
              )}

              <button
                onClick={signOut}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3.5 text-sm font-medium active:bg-accent transition"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {icon}
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</h2>
    </div>
  );
}
