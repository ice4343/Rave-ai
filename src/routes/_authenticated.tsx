import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/session";
import { Sidebar } from "@/components/Sidebar";
import { Loader2, Menu, Sparkles } from "lucide-react";
import { applyTheme, loadTheme } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: Layout,
});

function Layout() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/" });
  }, [session, loading, navigate]);

  useEffect(() => {
    applyTheme(loadTheme());
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar
        userEmail={session.user.email ?? undefined}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile header with toggle */}
        <header className="md:hidden flex items-center gap-2 border-b border-border bg-background/80 backdrop-blur px-3 h-12 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
            className="rounded-md p-2 hover:bg-accent transition"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-6 w-6 shrink-0 rounded-md bg-primary flex items-center justify-center">
              <Sparkles className="h-3 w-3 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm truncate">Rave.ai</span>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
