import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/session";
import { Sidebar } from "@/components/Sidebar";
import { Loader2, Menu, Plus } from "lucide-react";
import { applySettings, loadSettings } from "@/lib/theme";
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
    applySettings(loadSettings());
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Horizontal swipe from anywhere on screen: right opens, left closes.
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let decided = false;

    const isScrollableX = (target: EventTarget | null) => {
      let el = target as HTMLElement | null;
      while (el && el !== document.body) {
        if (el.scrollWidth > el.clientWidth + 4) {
          const style = getComputedStyle(el).overflowX;
          if (style === "auto" || style === "scroll") return true;
        }
        el = el.parentElement;
      }
      return false;
    };

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      decided = false;
      tracking = !isScrollableX(e.target);
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking || decided) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
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
    <div className="app-aurora relative flex h-[100dvh] w-full overflow-hidden">
      <Sidebar
        userEmail={session.user.email ?? undefined}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="relative z-10 flex-1 flex flex-col min-w-0">
        <header className="glass-panel flex items-center gap-1 border-b border-[var(--glass-border)] px-2 h-14 shrink-0 pt-[env(safe-area-inset-top)] box-content">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
            className="rounded-full p-2.5 active:bg-accent/70 transition"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="font-semibold text-[15px] tracking-tight truncate">
              Rave<span className="text-primary">.ai</span>
            </span>
          </div>
          <button
            onClick={newChat}
            aria-label="New chat"
            className="rounded-full p-2.5 active:bg-accent/70 transition"
          >
            <Plus className="h-5 w-5" />
          </button>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
