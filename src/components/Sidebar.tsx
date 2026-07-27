import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Settings, MessageSquare, Sparkles } from "lucide-react";
import { memo, useState } from "react";

type Thread = { id: string; title: string; updated_at: string };

export const Sidebar = memo(function Sidebar({
  userEmail,
  open,
  onClose,
}: {
  userEmail?: string;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const params = useParams({ strict: false }) as { threadId?: string };
  const [creating, setCreating] = useState(false);

  const { data: threads = [] } = useQuery({
    queryKey: ["threads"],
    staleTime: 30_000,
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
    if (creating) return;
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
      qc.setQueryData<Thread[]>(["threads"], (old) => [
        { id: data.id, title: "New chat", updated_at: new Date().toISOString() },
        ...(old ?? []),
      ]);
      onClose();
      navigate({ to: "/chat/$threadId", params: { threadId: data.id } });
    } finally {
      setCreating(false);
    }
  };

  const deleteThread = async (id: string) => {
    // Optimistic — no toast, instant feel.
    qc.setQueryData<Thread[]>(["threads"], (old) => (old ?? []).filter((t) => t.id !== id));
    if (params.threadId === id) {
      onClose();
      navigate({ to: "/chat" });
    }
    await supabase.from("messages").delete().eq("thread_id", id);
    await supabase.from("threads").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["threads"] });
  };

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-black/60 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden
      />
      <aside
        className={`fixed z-40 top-0 left-0 h-[100dvh] w-[82vw] max-w-xs flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground will-change-transform transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-4 pt-[env(safe-area-inset-top)] pb-3 border-b border-sidebar-border">
          <div className="flex items-center gap-2 min-w-0 h-14">
            <div className="h-8 w-8 shrink-0 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm leading-tight truncate">Rave.ai</div>
              <div className="text-[11px] text-muted-foreground truncate">AI with personality</div>
            </div>
          </div>
          <button
            onClick={newChat}
            disabled={creating}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium py-3 active:scale-[0.98] transition disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            New chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scroll py-2 overscroll-contain">
          {threads.length === 0 ? (
            <div className="px-4 py-8 text-xs text-muted-foreground text-center">
              No conversations yet.
            </div>
          ) : (
            <ul className="px-2 space-y-0.5">
              {threads.map((t) => {
                const active = params.threadId === t.id;
                return (
                  <li key={t.id} className="relative">
                    <Link
                      to="/chat/$threadId"
                      params={{ threadId: t.id }}
                      onClick={onClose}
                      className={`flex items-center gap-2 rounded-xl pl-3 pr-10 py-3 text-sm transition ${
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/85 active:bg-sidebar-accent/60"
                      }`}
                    >
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate flex-1">{t.title || "New chat"}</span>
                    </Link>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        deleteThread(t.id);
                      }}
                      aria-label="Delete chat"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground active:text-destructive active:bg-destructive/15 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] border-t border-sidebar-border">
          <Link
            to="/settings"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm active:bg-sidebar-accent/60 transition"
          >
            <div className="h-8 w-8 shrink-0 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-[11px] font-medium text-primary">
              {userEmail?.[0]?.toUpperCase() ?? "?"}
            </div>
            <span className="flex-1 min-w-0 truncate text-xs text-muted-foreground">
              {userEmail ?? "Signed in"}
            </span>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </Link>
        </div>
      </aside>
    </>
  );
});
