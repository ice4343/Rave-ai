import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Muse — Personality & Settings" },
      { name: "description", content: "Shape Muse's personality and tone." },
    ],
  }),
  component: Settings,
});

const PRESETS = [
  {
    name: "Friendly assistant",
    text: "You are a helpful, friendly, and concise AI assistant.",
  },
  {
    name: "Blunt expert",
    text: "You are a blunt, no-nonsense expert. Give direct answers with confidence. Skip filler and pleasantries.",
  },
  {
    name: "Playful pal",
    text: "You are a playful, witty companion. Use light humor, gentle emojis when it fits, and keep the vibe warm.",
  },
  {
    name: "Socratic tutor",
    text: "You are a Socratic tutor. Guide the user to answers by asking thoughtful questions. Explain step by step.",
  },
];

function Settings() {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

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
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;
      const { error } = await supabase
        .from("profiles")
        .update({ personality: text })
        .eq("id", user.user.id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Personality saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scroll">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link to="/chat" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to chat
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Personality</h1>
            <p className="text-sm text-muted-foreground">
              This system prompt shapes how Muse talks with you.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">
              System prompt
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
              className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
              placeholder="Describe how Muse should behave…"
            />

            <div className="mt-3 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => setText(p.text)}
                  className="text-xs rounded-full border border-border bg-card px-3 py-1.5 hover:bg-accent hover:border-primary/40 transition"
                >
                  {p.name}
                </button>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={save}
                disabled={saving || !text.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save personality
              </button>
              <span className="text-xs text-muted-foreground">
                Applies to new messages in every chat.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
