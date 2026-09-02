import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Settings, MessageSquare, Search, X, MoreVertical, Pencil } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { RaveMark } from "@/components/RaveMark";

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
  const [query, setQuery] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId) renameRef.current?.focus();
  }, [renamingId]);

  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menuFor]);

  useEffect(() => {
    if (!open) {
      setMenuFor(null);
      setRenamingId(null);
    }
  }, [open]);

  const { data: threads = [] } = useQuery({
    queryKey: ["threads"],
    staleTime: 5_000,
    refetchInterval: 8_000,
    refetchIntervalInBackground: false,
    queryFn: async (): Promise<Thread[]> => {
      // Inner join: only threads that already contain at least one message.
      // Freshly auto-created "New chat" threads stay hidden until the user
      // actually sends something in them.
      const { data, error } = await supabase
        .from("threads")
        .select("id, title, updated_at, messages!inner(id)")
        .limit(1, { referencedTable: "messages" })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(({ id, title, updated_at }) => ({ id, title, updated_at }));
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => (t.title || "New chat").toLowerCase().includes(q));
  }, [threads, query]);

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
      // Don't add it optimistically — an empty thread stays hidden until the
      // first message lands and the query refetches.
      onClose();
      navigate({ to: "/chat/$threadId", params: { threadId: data.id } });
    } finally {
      setCreating(false);
    }
  };

  const deleteThread = async (id: string) => {
    qc.setQueryData<Thread[]>(["threads"], (old) => (old ?? []).filter((t) => t.id !== id));
    if (params.threadId === id) {
      onClose();
      navigate({ to: "/chat" });
    }
    await supabase.from("messages").delete().eq("thread_id", id);
    await supabase.from("threads").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["threads"] });
  };

  const startRename = (t: Thread) => {
    setMenuFor(null);
    setRenamingId(t.id);
    setRenameValue(t.title || "New chat");
  };

  const commitRename = async (id: string) => {
    const next = renameValue.trim();
    setRenamingId(null);
    if (!next) return;
    const current = threads.find((t) => t.id === id);
    if (!current || current.title === next) return;
    qc.setQueryData<Thread[]>(["threads"], (old) =>
      (old ?? []).map((t) => (t.id === id ? { ...t, title: next } : t)),
    );
    await supabase.from("threads").update({ title: next }).eq("id", id);
  };

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px] transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden
      />
      <aside
        className={`glass-strong fixed z-40 top-0 left-0 h-[100dvh] w-[84vw] max-w-xs flex flex-col border-r border-[var(--glass-border)] text-sidebar-foreground will-change-transform transition-transform duration-250 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-3 pt-[env(safe-area-inset-top)] pb-3">
          <div className="flex items-center gap-2 min-w-0 h-14 px-1">
            <div className="h-8 w-8 shrink-0 rounded-xl bg-background/60 border border-[var(--glass-border)] flex items-center justify-center">
              <RaveMark className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm leading-tight truncate">
                Rave<span className="text-primary">.ai</span>
              </div>
              <div className="text-[11px] text-muted-foreground truncate">AI with personality</div>
            </div>
          </div>

          {/* Search chats */}
          <div className="relative mb-2.5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats"
              className="glass w-full rounded-full pl-9 pr-9 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40 transition"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground active:bg-accent/70"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={newChat}
            disabled={creating}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground text-sm font-medium py-3 active:scale-[0.98] transition disabled:opacity-60 shadow-lg shadow-primary/20"
          >
            <Plus className="h-4 w-4" />
            New chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scroll py-1 overscroll-contain">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-xs text-muted-foreground text-center">
              {query ? "No chats match that search." : "No conversations yet."}
            </div>
          ) : (
            <ul className="px-2 space-y-0.5">
              {filtered.map((t) => {
                const active = params.threadId === t.id;
                const renaming = renamingId === t.id;
                return (
                  <li key={t.id} className="relative">
                    {renaming ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          commitRename(t.id);
                        }}
                        className="px-1 py-1.5"
                      >
                        <input
                          ref={renameRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => commitRename(t.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          className="glass w-full rounded-2xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                        />
                      </form>
                    ) : (
                      <>
                        <Link
                          to="/chat/$threadId"
                          params={{ threadId: t.id }}
                          onClick={onClose}
                          className={`flex items-center gap-2.5 rounded-2xl pl-3 pr-10 py-3 text-sm transition ${
                            active
                              ? "bg-primary/15 text-foreground border border-primary/25"
                              : "text-sidebar-foreground/85 active:bg-sidebar-accent/60 border border-transparent"
                          }`}
                        >
                          <MessageSquare
                            className={`h-3.5 w-3.5 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`}
                          />
                          <span className="truncate flex-1">{t.title || "New chat"}</span>
                        </Link>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setMenuFor(menuFor === t.id ? null : t.id);
                          }}
                          aria-label="Chat options"
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-2 text-muted-foreground active:bg-accent/70 transition"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {menuFor === t.id && (
                          <div onPointerDown={(e) => e.stopPropagation()} className="glass-strong absolute right-2 top-[calc(100%-6px)] z-50 w-36 overflow-hidden rounded-2xl border border-[var(--glass-border)] shadow-xl">
                            <button
                              onClick={() => startRename(t)}
                              className="flex w-full items-center gap-2 px-3 py-2.5 text-sm active:bg-accent/70"
                            >
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                              Rename
                            </button>
                            <button
                              onClick={() => {
                                setMenuFor(null);
                                deleteThread(t.id);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-destructive active:bg-destructive/15"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] border-t border-[var(--glass-border)]">
          <Link
            to="/settings"
            onClick={onClose}
            aria-label="Open settings"
            className="glass flex items-center gap-3 rounded-2xl border border-primary/30 px-3.5 py-3.5 text-sm active:bg-sidebar-accent/60 transition"
          >
            <div className="h-9 w-9 shrink-0 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-medium text-primary">
              {userEmail?.[0]?.toUpperCase() ?? "?"}
            </div>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-foreground">Settings</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {userEmail ?? "Signed in"}
              </span>
            </span>
            <Settings className="h-6 w-6 shrink-0 text-primary" />
          </Link>
        </div>

      </aside>
    </>
  );
});
