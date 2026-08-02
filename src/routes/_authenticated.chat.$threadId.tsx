import { RaveMark } from "@/components/RaveMark";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowUp, Loader2, Plus, ImageIcon, Paperclip, X, FileText, Check, ChevronDown } from "lucide-react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import { fileToCompressedDataUrl } from "@/lib/image";
import { loadSettings } from "@/lib/theme";
import { CHAT_MODELS, getModel, loadModel, saveModel } from "@/lib/models";

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
type FileAttachment = { name: string; mime: string; text?: string; dataUrl?: string };

// Only these are safe to inline as plain text; anything else (PDF, docx…) is
// binary and must be sent as base64 so it doesn't corrupt the message content.
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|ya?ml|xml|html?|css|jsx?|tsx?|py|rb|go|rs|java|c|h|cpp|sh|sql|ini|toml|log)$/i;

function isTextFile(file: File) {
  return file.type.startsWith("text/") || TEXT_EXT.test(file.name);
}

// Strip NUL + lone surrogates — Postgres rejects them ("unsupported Unicode escape sequence").
function sanitizeText(s: string) {
  return s
    .replace(/\u0000/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

function StarMark({ className = "" }: { className?: string }) {
  return <RaveMark className={className} />;
}


export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "Rave.ai — Conversation" },
      { name: "description", content: "Your AI conversation with Rave.ai." },
      { property: "og:title", content: "Rave.ai — Conversation" },
      { property: "og:description", content: "Chat, attach files and images, and generate art." },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { threadId } = Route.useParams();
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<string | null>(null);
  const [fileAttachment, setFileAttachment] = useState<FileAttachment | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modelId, setModelId] = useState<string>(CHAT_MODELS[0].id);
  const [modelMenu, setModelMenu] = useState(false);
  const [painting, setPainting] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setModelId(loadModel());
  }, []);

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

  const { data: displayName } = useQuery({
    queryKey: ["display-name"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string | null> => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", auth.user.id)
        .maybeSingle();
      return data?.display_name ?? null;
    },
  });

  const greeting = displayName ? `Let's jump in, ${displayName}` : "Let's jump in";

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  useEffect(() => {
    if (!menuOpen && !modelMenu) return;
    const close = () => {
      setMenuOpen(false);
      setModelMenu(false);
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuOpen, modelMenu]);

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
      setError(null);
    } catch {
      setError("Couldn't read that image.");
    }
  };

  const pickFile = async (file?: File | null) => {
    if (!file) return;
    if (file.type.startsWith("image/")) return pickImage(file);
    const textual = isTextFile(file);
    const limit = textual ? 400_000 : 8_000_000;
    if (file.size > limit) {
      setError(textual ? "File is too large — keep it under 400 KB." : "File is too large — keep it under 8 MB.");
      return;
    }
    try {
      if (textual) {
        const text = await file.text();
        setFileAttachment({
          name: file.name,
          mime: file.type || "text/plain",
          text: sanitizeText(text).slice(0, 60_000),
        });
      } else {
        setFileAttachment({
          name: file.name,
          mime: file.type || "application/octet-stream",
          dataUrl: await fileToDataUrl(file),
        });
      }
      setError(null);
    } catch {
      setError("Couldn't read that file.");
    }
  };

  const runPrompt = async (
    text: string,
    image: string | null,
    file: FileAttachment | null,
  ) => {
    const wasImage = !image && !file && isImageRequest(text);
    setError(null);
    setBusy(true);
    setPainting(wasImage);
    setStreaming("");

    const outgoing = file?.text
      ? `${text}\n\n--- Attached file: ${file.name} ---\n${file.text}`
      : text;

    const optimistic: Msg = {
      id: "optimistic-" + Date.now(),
      role: "user",
      content:
        (wasImage ? `🎨 ${text}` : text) +
        (file ? `\n\n📎 ${file.name}` : "") +
        (image ? `\n\n![attachment](${image})` : ""),
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
          body: JSON.stringify({
            threadId,
            model: modelId,
            message: outgoing,
            image,
            file: file?.dataUrl
              ? { name: file.name, mime: file.mime, dataUrl: file.dataUrl }
              : null,
          }),
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
      setError(e instanceof Error ? e.message : "Something went wrong");
      qc.setQueryData<Msg[]>(["messages", threadId], (old) =>
        (old ?? []).filter((m) => m.id !== optimistic.id),
      );
      setStreaming("");
    } finally {
      setBusy(false);
      setPainting(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if ((!text && !attachment && !fileAttachment) || busy) return;
    const image = attachment;
    const file = fileAttachment;
    setInput("");
    setAttachment(null);
    setFileAttachment(null);
    requestAnimationFrame(autosize);
    await runPrompt(text, image, file);
  };

  // Edit a sent prompt: drop it (and everything after it) then re-run the turn.
  const editMessage = async (msg: Msg, newText: string) => {
    const text = newText.trim();
    if (!text || busy) return;
    const list = qc.getQueryData<Msg[]>(["messages", threadId]) ?? messages;
    const idx = list.findIndex((m) => m.id === msg.id);
    const removed = idx >= 0 ? list.slice(idx) : [msg];
    const ids = removed.map((m) => m.id).filter((id) => !id.startsWith("optimistic-"));
    qc.setQueryData<Msg[]>(["messages", threadId], idx >= 0 ? list.slice(0, idx) : list);
    if (ids.length) {
      const { error: delError } = await supabase.from("messages").delete().in("id", ids);
      if (delError) {
        setError("Couldn't update that message.");
        qc.invalidateQueries({ queryKey: ["messages", threadId] });
        return;
      }
    }
    const image = msg.content.match(/!\[[^\]]*\]\((data:image\/[^)]+)\)/)?.[1] ?? null;
    await runPrompt(text, image, null);
  };


  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const enterToSend = loadSettings().enterToSend;
    const desktop = !("ontouchstart" in window);
    if (e.key === "Enter" && !e.shiftKey && (enterToSend || desktop)) {
      e.preventDefault();
      send();
    }
  };

  const empty = messages.length === 0 && !streaming;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scroll overscroll-contain">
        <div className={`max-w-2xl mx-auto px-3 ${empty ? "min-h-full flex" : "py-4"}`}>
          {isLoading ? (
            <div className="flex justify-center py-12 w-full">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : empty ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center animate-rise pb-16">
              <StarMark className="h-12 w-12 mb-5 text-primary drop-shadow-[0_0_24px_oklch(var(--accent-raw)/0.45)]" />
              <h2 className="text-[2rem] leading-tight font-normal tracking-tight text-foreground/90">
                {greeting}
              </h2>
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

      <div className="pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
        <div className="max-w-2xl mx-auto px-3 pb-2 pt-1">

          {error && (
            <div className="mb-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          {(attachment || fileAttachment) && (
            <div className="flex items-center gap-2 mb-2">
              {attachment && (
                <div className="relative">
                  <img
                    src={attachment}
                    alt="attachment"
                    className="h-20 w-20 object-cover rounded-2xl border border-[var(--glass-border)]"
                  />
                  <button
                    onClick={() => setAttachment(null)}
                    aria-label="Remove image"
                    className="glass absolute -top-2 -right-2 rounded-full p-1"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {fileAttachment && (
                <div className="glass relative flex items-center gap-2 rounded-2xl px-3 py-2.5 max-w-[60%]">
                  <FileText className="h-4 w-4 shrink-0 text-primary" />
                  <span className="text-xs truncate">{fileAttachment.name}</span>
                  <button
                    onClick={() => setFileAttachment(null)}
                    aria-label="Remove file"
                    className="rounded-full p-1 text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="relative mb-2 flex justify-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setModelMenu((o) => !o);
              }}
              aria-expanded={modelMenu}
              className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground active:bg-accent/70 transition"
            >
              <RaveMark className="h-3 w-3 text-primary" />
              {getModel(modelId).name}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${modelMenu ? "rotate-180" : ""}`} />
            </button>
            {modelMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="glass-strong animate-pop absolute bottom-10 z-20 w-64 rounded-2xl p-1.5 shadow-2xl"
              >
                {CHAT_MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setModelId(m.id);
                      saveModel(m.id);
                      setModelMenu(false);
                    }}
                    className="flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left active:bg-accent/70 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{m.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{m.hint}</div>
                    </div>
                    {modelId === m.id && <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="glass flex items-end gap-1.5 rounded-[32px] px-2 py-2 shadow-lg shadow-black/20 focus-within:ring-2 focus-within:ring-ring/40 transition">
            <input
              ref={imageRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                pickImage(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />

            {/* "+" attach menu */}
            <div className="relative shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((o) => !o);
                }}
                aria-label="Add attachment"
                aria-expanded={menuOpen}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground active:bg-accent/70 transition ${
                  menuOpen ? "bg-accent/60 rotate-45" : ""
                }`}
              >
                <Plus className="h-5 w-5 transition-transform" />
              </button>
              {menuOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="glass-strong animate-pop absolute bottom-12 left-0 z-20 w-48 rounded-2xl p-1.5 shadow-2xl"
                >
                  <MenuItem
                    icon={<ImageIcon className="h-4 w-4 text-primary" />}
                    label="Attach image"
                    onClick={() => {
                      setMenuOpen(false);
                      imageRef.current?.click();
                    }}
                  />
                  <MenuItem
                    icon={<Paperclip className="h-4 w-4 text-primary" />}
                    label="Attach file"
                    onClick={() => {
                      setMenuOpen(false);
                      fileRef.current?.click();
                    }}
                  />
                </div>
              )}
            </div>

            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autosize();
              }}
              onKeyDown={onKeyDown}
              placeholder="Ask Rave.ai"
              rows={1}
              className="flex-1 resize-none bg-transparent py-2.5 px-1 text-base outline-none min-h-[40px] max-h-40 leading-snug placeholder:text-muted-foreground/70"
            />
            <button
              onClick={send}
              disabled={busy || (!input.trim() && !attachment && !fileAttachment)}
              className="shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-95 transition disabled:opacity-40"
              aria-label="Send"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-sm active:bg-accent/70 transition"
    >
      {icon}
      {label}
    </button>
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
      <div className="flex justify-end animate-rise">
        <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-primary text-primary-foreground px-4 py-2.5 text-[0.95rem] shadow-lg shadow-primary/15 whitespace-pre-wrap break-words">
          <UserContent content={content} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5 animate-rise">
      <div className="h-7 w-7 shrink-0 flex items-center justify-center mt-0.5">
        <RaveMark className="h-5 w-5 text-primary" />
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
      <img src={match[1]} alt="attachment" className="rounded-2xl max-w-full h-auto mb-2" />
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
            className="rounded-2xl border border-[var(--glass-border)] max-w-full h-auto my-2"
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
      className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse"
      style={{ animationDelay: `${delay}s` }}
    />
  );
}
