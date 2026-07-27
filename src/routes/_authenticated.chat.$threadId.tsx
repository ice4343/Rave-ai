import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Loader2, Sparkles, ImagePlus, X } from "lucide-react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import { fileToCompressedDataUrl } from "@/lib/image";

// Auto-detect image requests so the user never has to flip a mode switch.
const IMAGE_INTENT =
  /\b(?:generate|create|make|draw|paint|design|render|sketch|show me)\b[^.?!]{0,40}\b(?:image|picture|photo|photograph|illustration|drawing|painting|artwork|logo|poster|wallpaper|portrait|sketch)\b/i;

function isImageRequest(text: string) {
  return IMAGE_INTENT.test(text);
}

function toImagePrompt(text: string) {
  const cleaned = text
    .replace(
      /^\s*(?:please\s+)?(?:can you\s+|could you\s+)?(?:generate|create|make|draw|paint|design|render|sketch|show me)\s+(?:me\s+)?(?:an?|some|the)?\s*(?:image|picture|photo|photograph|illustration|drawing|painting|artwork)\s*(?:of|showing|with|for)?\s*/i,
      "",
    )
    .trim();
  return cleaned.length > 2 ? cleaned : text;
}

type Msg = { id: string; role: "user" | "assistant" | "system"; content: string; created_at: string };

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "Rave.ai — Conversation" },
      { name: "description", content: "Your AI conversation with Rave.ai." },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { threadId } = Route.useParams();
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<string | null>(null);
  const [painting, setPainting] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages", threadId],
    staleTime: 60_000,
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
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  const autosize = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const pickImage = async (file?: File | null) => {
    if (!file) return;
    try {
      setAttachment(await fileToCompressedDataUrl(file));
    } catch {
      toast.error("Couldn't read that image");
    }
  };

  const send = async () => {
    const text = input.trim();
    if ((!text && !attachment) || busy) return;
    const image = attachment;
    const wasImage = !image && isImageRequest(text);
    setInput("");
    setAttachment(null);
    setBusy(true);
    setPainting(wasImage);
    setStreaming("");
    requestAnimationFrame(autosize);

    const optimistic: Msg = {
      id: "optimistic-" + Date.now(),
      role: "user",
      content: (wasImage ? `🎨 ${text}` : text) + (image ? `\n\n![attachment](${image})` : ""),
      created_at: new Date().toISOString(),
    };
    qc.setQueryData<Msg[]>(["messages", threadId], (old) => [...(old ?? []), optimistic]);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Not signed in");

      if (wasImage) {
        const res = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ threadId, prompt: toImagePrompt(text) }),
        });
        if (!res.ok) throw new Error((await res.text()) || "Image request failed");
      } else {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ threadId, message: text, image }),
        });
        if (!res.ok || !res.body) throw new Error((await res.text()) || "Request failed");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setStreaming(acc);
        }
      }

      await qc.invalidateQueries({ queryKey: ["messages", threadId] });
      qc.invalidateQueries({ queryKey: ["threads"] });
      setStreaming("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      qc.setQueryData<Msg[]>(["messages", threadId], (old) =>
        (old ?? []).filter((m) => m.id !== optimistic.id),
      );
      setStreaming("");
    } finally {
      setBusy(false);
      setPainting(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scroll overscroll-contain">
        <div className="max-w-2xl mx-auto px-3 py-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 && !streaming ? (
            <div className="text-center py-20">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center mb-4">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">How can I help?</h2>
              <p className="text-sm text-muted-foreground mt-1 px-6">
                Ask anything, attach a photo, or say “generate an image of…”.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((m) => (
                <Bubble key={m.id} role={m.role} content={m.content} />
              ))}
              {streaming && <Bubble role="assistant" content={streaming} streaming />}
              {busy && !streaming && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground pl-1">
                  <span className="inline-flex gap-1">
                    <Dot /> <Dot delay={0.15} /> <Dot delay={0.3} />
                  </span>
                  {painting ? "Painting…" : "Thinking…"}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border bg-background/85 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-2xl mx-auto px-3 py-2.5">
          {attachment && (
            <div className="relative inline-block mb-2">
              <img src={attachment} alt="attachment" className="h-20 w-20 object-cover rounded-xl border border-border" />
              <button
                onClick={() => setAttachment(null)}
                aria-label="Remove attachment"
                className="absolute -top-2 -right-2 rounded-full bg-card border border-border p-1"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring/50 transition">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                pickImage(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              aria-label="Attach image"
              className="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground active:bg-accent transition"
            >
              <ImagePlus className="h-5 w-5" />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autosize();
              }}
              onKeyDown={onKeyDown}
              placeholder="Message Rave.ai…"
              rows={1}
              className="flex-1 resize-none bg-transparent py-2.5 text-base outline-none min-h-[40px] max-h-40 leading-snug"
            />
            <button
              onClick={send}
              disabled={busy || (!input.trim() && !attachment)}
              className="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground active:scale-95 transition disabled:opacity-40"
              aria-label="Send"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const Bubble = memo(function Bubble({
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
        <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-primary text-primary-foreground px-3.5 py-2.5 text-[0.95rem] shadow-sm whitespace-pre-wrap break-words">
          <UserContent content={content} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5">
      <div className="h-7 w-7 shrink-0 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center mt-0.5">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className={`msg-prose text-[0.95rem] flex-1 min-w-0 ${streaming ? "streaming-cursor" : ""}`}>
        <Markdown content={content} />
      </div>
    </div>
  );
});

function UserContent({ content }: { content: string }) {
  const match = content.match(/!\[[^\]]*\]\((data:image\/[^)]+)\)/);
  if (!match) return <>{content}</>;
  const text = content.replace(match[0], "").trim();
  return (
    <>
      <img src={match[1]} alt="attachment" className="rounded-xl max-w-full h-auto mb-2" />
      {text}
    </>
  );
}

function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      // Default transform strips `data:` URLs, which blanks out generated images.
      urlTransform={(url) => (url.startsWith("data:image/") ? url : defaultUrlTransform(url))}
      components={{
        img: ({ node: _n, ...props }) => (
          <img
            {...props}
            loading="lazy"
            className="rounded-xl border border-border max-w-full h-auto my-2"
            alt={props.alt ?? "generated"}
          />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
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
