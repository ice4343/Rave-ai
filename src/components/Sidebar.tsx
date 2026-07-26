import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Settings, LogOut, MessageSquare, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

type Thread = { id: string; title: string; updated_at: string };

export function Sidebar({ userEmail }: { userEmail?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const params = useParams({ strict: false }) as { threadId?: string };
  const [creating, setCreating] = useState(false);

  const { data: threads = [] } = useQuery({
    queryKey: ["threads"],
    queryFn: async (): Promise<Thread[]> => {
      const { data, error } = await supabase
        .from("threads")
        .select("id, title, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const newChat = async () => {
    setCreating(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;
      const { data, error } = await supabase
        .from("threads")
        .insert({ user_id: user.user.id, title: "New chat" })
        .select("id")
        .single();
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: data.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create chat");
    } finally {
      setCreating(false);
    }
  };

  const deleteThread = async (id: string) => {
    const { error } = await supabase.from("threads").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Chat deleted");
    await qc.invalidateQueries({ queryKey: ["threads"] });
    if (params.threadId === id) navigate({ to: "/chat" });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <aside className="w-72 shrink-0 h-screen flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="p-4 border-b border-sidebar-border">
        <Link to="/chat" className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <div className="font-semibold text-sm leading-tight">Muse</div>
            <div className="text-[11px] text-muted-foreground">AI with personality</div>
          </div>
        </Link>
        <button
          onClick={newChat}
          disabled={creating}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium py-2 hover:opacity-90 transition disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scroll py-2">
        {threads.length === 0 ? (
          <div className="px-4 py-8 text-xs text-muted-foreground text-center">
            No conversations yet.
          </div>
        ) : (
          <ul className="px-2 space-y-0.5">
            {threads.map((t) => {
              const active = params.threadId === t.id;
              return (
                <li key={t.id} className="group relative">
                  <Link
                    to="/chat/$threadId"
                    params={{ threadId: t.id }}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "hover:bg-sidebar-accent/60 text-sidebar-foreground/85"
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate flex-1">{t.title || "New chat"}</span>
                  </Link>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (confirm("Delete this chat?")) deleteThread(t.id);
                    }}
                    aria-label="Delete chat"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 rounded-md p-1.5 hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="p-3 border-t border-sidebar-border space-y-1">
        <Link
          to="/settings"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent/60 transition"
        >
          <Settings className="h-4 w-4" />
          Personality & settings
        </Link>
        <div className="flex items-center gap-2 px-3 pt-2">
          <div className="h-7 w-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-[11px] font-medium text-primary">
            {userEmail?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs truncate">{userEmail ?? "Signed in"}</div>
          </div>
          <button
            onClick={signOut}
            aria-label="Sign out"
            className="rounded-md p-1.5 hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
