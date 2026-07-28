import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Check,
  Download,
  Info,
  Keyboard,
  LayoutGrid,
  Loader2,
  LogOut,
  Moon,
  Palette,
  Save,
  Sparkles,
  Sun,
  Trash2,
  Type,
  User,
  Monitor,
  Layers,
} from "lucide-react";
import {
  DEFAULT_SETTINGS,
  THEME_PRESETS,
  applySettings,
  loadSettings,
  saveSettings,
  type Density,
  type Mode,
  type ThemeSettings,
} from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Rave.ai — Settings" },
      { name: "description", content: "Shape Rave.ai's personality, appearance, and behaviour." },
      { property: "og:title", content: "Rave.ai — Settings" },
      { property: "og:description", content: "Personality, themes, text size and chat controls." },
    ],
  }),
  component: Settings,
});

const PRESETS = [
  { name: "Friendly", text: "You are a helpful, friendly, and concise AI assistant." },
  { name: "Blunt expert", text: "You are a blunt, no-nonsense expert. Give direct answers with confidence. Skip filler and pleasantries." },
  { name: "Playful pal", text: "You are a playful, witty companion. Use light humor, gentle emojis when it fits, and keep the vibe warm." },
  { name: "Socratic tutor", text: "You are a Socratic tutor. Guide the user to answers by asking thoughtful questions. Explain step by step." },
  { name: "Creative writer", text: "You are a vivid creative writer. Favour imagery, rhythm and strong verbs. Offer options when asked to write." },
  { name: "Code buddy", text: "You are a senior engineer. Answer with correct, minimal code and short explanations. Prefer examples over prose." },
];

function Settings() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [settings, setSettings] = useState<ThemeSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const update = (patch: Partial<ThemeSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

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
      await supabase
        .from("profiles")
        .update({ personality: text, display_name: name.trim() || null })
        .eq("id", user.user.id);
      await qc.invalidateQueries({ queryKey: ["profile"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 1400);
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

  const exportData = async () => {
    const { data: threads } = await supabase.from("threads").select("id, title, created_at");
    const { data: messages } = await supabase
      .from("messages")
      .select("thread_id, role, content, created_at");
    const blob = new Blob([JSON.stringify({ threads, messages }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rave-ai-export.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetAppearance = () => {
    setSettings(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
    applySettings(DEFAULT_SETTINGS);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/" });
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
          <div className="space-y-4">
            {/* Profile */}
            <Card>
              <SectionTitle icon={<User className="h-4 w-4 text-primary" />} label="Your name" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What should Rave.ai call you?"
                className="glass w-full rounded-2xl px-4 py-3.5 text-base outline-none focus:ring-2 focus:ring-ring/40"
              />
            </Card>

            {/* Personality */}
            <Card>
              <SectionTitle icon={<Sparkles className="h-4 w-4 text-primary" />} label="Personality" />
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                className="glass w-full rounded-2xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring/40 resize-y"
                placeholder="Describe how Rave.ai should behave…"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => setText(p.text)}
                    className="glass text-xs rounded-full px-3 py-2 active:bg-accent/70 transition"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <button
                onClick={save}
                disabled={saving}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground px-4 py-3.5 text-sm font-medium active:scale-[0.99] transition disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : saved ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saved ? "Saved" : "Save"}
              </button>
            </Card>

            {/* Accent */}
            <Card>
              <SectionTitle icon={<Palette className="h-4 w-4 text-primary" />} label="Accent color" />
              <div className="grid grid-cols-4 gap-2.5">
                {THEME_PRESETS.map((p) => {
                  const active = settings.accent === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => update({ accent: p.id })}
                      className={`relative rounded-2xl border p-2.5 flex flex-col items-center gap-1.5 transition ${
                        active ? "border-primary bg-primary/10" : "border-[var(--glass-border)]"
                      }`}
                      aria-label={`Use ${p.name} accent`}
                    >
                      <span className="h-7 w-7 rounded-full" style={{ background: `oklch(${p.primary})` }} />
                      <span className="text-[10px] text-muted-foreground">{p.name}</span>
                      {active && <Check className="absolute top-1 right-1 h-3 w-3 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Appearance */}
            <Card>
              <SectionTitle icon={<Sun className="h-4 w-4 text-primary" />} label="Appearance" />
              <Segmented<Mode>
                value={settings.mode}
                onChange={(mode) => update({ mode })}
                options={[
                  { value: "dark", label: "Dark", icon: <Moon className="h-3.5 w-3.5" /> },
                  { value: "light", label: "Light", icon: <Sun className="h-3.5 w-3.5" /> },
                  { value: "system", label: "System", icon: <Monitor className="h-3.5 w-3.5" /> },
                ]}
              />

              <Row icon={<Type className="h-4 w-4 text-primary" />} label="Text size">
                <span className="text-xs text-muted-foreground">{Math.round(settings.fontScale * 100)}%</span>
              </Row>
              <input
                type="range"
                min={0.9}
                max={1.2}
                step={0.05}
                value={settings.fontScale}
                onChange={(e) => update({ fontScale: Number(e.target.value) })}
                className="w-full accent-[var(--color-primary)]"
              />

              <div className="mt-4">
                <SectionTitle
                  icon={<LayoutGrid className="h-4 w-4 text-primary" />}
                  label="Message density"
                />
                <Segmented<Density>
                  value={settings.density}
                  onChange={(density) => update({ density })}
                  options={[
                    { value: "cozy", label: "Cozy" },
                    { value: "compact", label: "Compact" },
                  ]}
                />
              </div>

              <Toggle
                icon={<Layers className="h-4 w-4 text-primary" />}
                label="Glass effect"
                hint="Frosted translucent surfaces"
                checked={settings.glass}
                onChange={(glass) => update({ glass })}
              />
              <Toggle
                icon={<Keyboard className="h-4 w-4 text-primary" />}
                label="Enter to send"
                hint="On mobile, Enter sends instead of newline"
                checked={settings.enterToSend}
                onChange={(enterToSend) => update({ enterToSend })}
              />

              <button
                onClick={resetAppearance}
                className="mt-3 w-full rounded-2xl border border-[var(--glass-border)] py-3 text-sm active:bg-accent/60 transition"
              >
                Reset appearance
              </button>
            </Card>

            {/* Data */}
            <Card>
              <SectionTitle icon={<Download className="h-4 w-4 text-primary" />} label="Your data" />
              <button
                onClick={exportData}
                className="glass w-full inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-medium active:bg-accent/70 transition"
              >
                <Download className="h-4 w-4" />
                Export chats (JSON)
              </button>

              {confirmClear ? (
                <div className="mt-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
                  <p className="text-sm mb-3">Delete every chat and message? This can't be undone.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={clearAll}
                      disabled={clearing}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-destructive text-destructive-foreground py-3 text-sm font-medium disabled:opacity-60"
                    >
                      {clearing && <Loader2 className="h-4 w-4 animate-spin" />} Delete all
                    </button>
                    <button
                      onClick={() => setConfirmClear(false)}
                      className="flex-1 rounded-xl border border-[var(--glass-border)] py-3 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-destructive/40 text-destructive px-4 py-3.5 text-sm font-medium active:bg-destructive/10 transition"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete all chat history
                </button>
              )}
            </Card>

            {/* Account / about */}
            <Card>
              <SectionTitle icon={<Info className="h-4 w-4 text-primary" />} label="About" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Rave.ai — a personal AI companion with a personality you control. Chats, images and files
                stay tied to your account.
              </p>
              <button
                onClick={signOut}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--glass-border)] px-4 py-3.5 text-sm font-medium active:bg-accent/60 transition"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="glass rounded-3xl p-4">{children}</section>;
}

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {icon}
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</h2>
    </div>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mt-4 mb-2">
      {icon}
      <span className="text-sm flex-1">{label}</span>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
}) {
  return (
    <div className="glass grid grid-flow-col auto-cols-fr gap-1 rounded-full p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`inline-flex items-center justify-center gap-1.5 rounded-full py-2.5 text-xs font-medium transition ${
            value === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  icon,
  label,
  hint,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-full flex items-center gap-3 mt-4 text-left"
      role="switch"
      aria-checked={checked}
    >
      {icon}
      <span className="flex-1 min-w-0">
        <span className="block text-sm">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform ${
            checked ? "translate-x-[1.4rem]" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}
