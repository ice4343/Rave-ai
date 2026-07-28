import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useSession } from "@/lib/session";
import { Mail, Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rave.ai — Your AI companion with personality" },
      {
        name: "description",
        content:
          "Chat with an AI you can shape. Set its personality, attach files and photos, generate images, save every conversation.",
      },
      { property: "og:title", content: "Rave.ai — Your AI companion with personality" },
      {
        property: "og:description",
        content: "Minimalist AI chat with customizable personality, image generation, and saved history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/chat" });
  }, [session, loading, navigate]);

  const google = async () => {
    setBusy(true);
    setMessage(null);
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (res.error) {
      setMessage(res.error.message ?? "Google sign-in failed");
      setBusy(false);
    }
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setMessage("Account created. Check your email if confirmation is required.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="app-aurora relative min-h-[100dvh] w-full flex items-center justify-center px-4 py-12">
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto h-16 w-16 rounded-3xl bg-primary/90 flex items-center justify-center text-primary-foreground text-2xl font-bold shadow-[0_0_60px_-10px_oklch(var(--accent-raw)/0.8)] mb-5">
            R
          </div>
          <h1 className="text-4xl font-semibold tracking-tight">
            Rave<span className="text-primary">.ai</span>
          </h1>
          <p className="mt-3 text-muted-foreground text-sm px-4">
            A minimalist AI chat you can shape. Set its personality, attach anything, own the vibe.
          </p>
        </div>

        <div className="glass-strong rounded-3xl p-6 shadow-2xl">
          <button
            onClick={google}
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-foreground text-background px-4 py-3 text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-[var(--glass-border)]" />
            or with email
            <div className="h-px flex-1 bg-[var(--glass-border)]" />
          </div>

          <form onSubmit={submitEmail} className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="glass w-full rounded-2xl pl-10 pr-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
            <input
              type="password"
              required
              minLength={6}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="glass w-full rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground px-4 py-3 text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          {message && (
            <p className="mt-3 text-center text-xs text-muted-foreground">{message}</p>
          )}

          <p className="mt-4 text-center text-xs text-muted-foreground">
            {mode === "signin" ? "New here?" : "Have an account?"}{" "}
            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-primary hover:underline"
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
