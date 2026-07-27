import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/session";
import { Sidebar } from "@/components/Sidebar";
import { Loader2, Menu, Plus, Sparkles } from "lucide-react";
import { applyTheme, loadTheme } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: Layout,
});

function Layout() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const openRef = useRef(sidebarOpen);
  openRef.current = sidebarOpen;

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/" });
  }, [session, loading, navigate]);

  useEffect(() => {
    applyTheme(loadTheme());
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Swipe left→right opens the sidebar, right→left closes it.
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let decided = false;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      decided = false;
      // Open gesture must begin near the left edge; close gesture anywhere.
      tracking = openRef.current || startX < 40;
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking || decided) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      decided = true;
      if (dx > 0 && !openRef.current) setSidebarOpen(true);
      else if (dx < 0 && openRef.current) setSidebarOpen(false);
    };
    const onEnd = () => {
      tracking = false;
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, []);

  const newChat = useCallback(async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { data } = await supabase
      .from("threads")
      .insert({ user_id: user.user.id, title: "New chat" })
      .select("id")
      .single();
    if (!data) return;
    qc.invalidateQueries({ queryKey: ["threads"] });
    navigate({ to: "/chat/$threadId", params: { threadId: data.id } });
  }, [navigate, qc]);

  if (loading || !session) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden">
      <Sidebar
        userEmail={session.user.email ?? undefined}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-2 border-b border-border bg-background/85 backdrop-blur px-2 h-14 shrink-0 pt-[env(safe-area-inset-top)] box-content">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
            className="rounded-xl p-2.5 active:bg-accent transition"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="h-6 w-6 shrink-0 rounded-md bg-primary flex items-center justify-center">
              <Sparkles className="h-3 w-3 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm truncate">Rave.ai</span>
          </div>
          <button
            onClick={newChat}
            aria-label="New chat"
            className="rounded-xl p-2.5 active:bg-accent transition"
          >
            <Plus className="h-5 w-5" />
          </button>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
