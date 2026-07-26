import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chat/")({
  head: () => ({
    meta: [
      { title: "Muse — Chat" },
      { name: "description", content: "Start a new AI conversation with Muse." },
    ],
  }),
  component: ChatHome,
});

function ChatHome() {
  return (
    <div className="flex-1 flex items-center justify-center p-8" style={{ backgroundImage: "var(--gradient-hero)" }}>
      <div className="max-w-md text-center">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center mb-5">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Ready when you are</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Start a new chat from the sidebar, or open one of your saved conversations. Adjust Muse's personality in{" "}
          <span className="text-foreground">Personality &amp; settings</span>.
        </p>
      </div>
    </div>
  );
}
