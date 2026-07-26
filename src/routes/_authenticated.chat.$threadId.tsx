import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Loader2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Msg = { id: string; role: "user" | "assistant" | "system"; content: string; created_at: string };

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "Muse — Conversation" },
      { name: "description", content: "Your AI conversation with Muse." },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { threadId } = Route.useParams();
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages", threadId],
    queryFn: async (): Promise<Msg[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, role, content, created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    setStreaming("");

    // Optimistic user message
    const optimistic: Msg = {
      id: "optimistic-" + Date.now(),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    qc.setQueryData<Msg[]>(["messages", threadId], (old) => [...(old ?? []), optimistic]);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Not signed in");

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ threadId, message: text }),
      });

      if (!res.ok || !res.body) {
        const err = await res.text();
        throw new Error(err || `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setStreaming(acc);
      }

      // Refresh from DB so message IDs & thread title update
      await qc.invalidateQueries({ queryKey: ["messages", threadId] });
      await qc.invalidateQueries({ queryKey: ["threads"] });
      setStreaming("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      // Roll back optimistic
      qc.setQueryData<Msg[]>(["messages", threadId], (old) =>
        (old ?? []).filter((m) => m.id !== optimistic.id),
      );
      setStreaming("");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scroll">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-8">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 && !streaming ? (
            <div className="text-center py-16">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center mb-4">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">How can I help?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Say hi, ask anything, or shape my personality in settings.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((m) => (
                <Bubble key={m.id} role={m.role} content={m.content} />
              ))}
              {streaming && <Bubble role="assistant" content={streaming} streaming />}
              {busy && !streaming && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground pl-1">
                  <span className="inline-flex gap-1">
                    <Dot /> <Dot delay={0.15} /> <Dot delay={0.3} />
                  </span>
                  Thinking…
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border bg-background/60 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-4">
          <div className="relative rounded-2xl border border-border bg-card focus-within:ring-2 focus-within:ring-ring/50 transition">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Message Muse…  (Shift+Enter for newline)"
              rows={1}
              className="w-full resize-none bg-transparent px-4 py-3.5 pr-14 text-sm outline-none min-h-[52px] max-h-40"
            />
            <button
              onClick={send}
              disabled={busy || !input.trim()}
              className="absolute right-2 bottom-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-40"
              aria-label="Send"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 text-center">
            Muse can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}

function Bubble({
  role,
  content,
  streaming,
}: {
  role: "user" | "assistant" | "system";
  content: string;
  streaming?: boolean;
}) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm shadow-sm">
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <div className="h-7 w-7 shrink-0 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center mt-0.5">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className={`msg-prose text-[0.95rem] flex-1 min-w-0 ${streaming ? "streaming-cursor" : ""}`}>
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}

function Dot({ delay = 0 }: { delay?: number }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse"
      style={{ animationDelay: `${delay}s` }}
    />
  );
}
