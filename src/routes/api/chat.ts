import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { getModel } from "@/lib/models";

type ChatBody = {
  threadId: string;
  message: string;
  model?: string | null;
  image?: string | null;
  file?: { name: string; mime: string; dataUrl: string } | null;
};

// Postgres text can't store NUL or lone surrogates.
function sanitize(s: string) {
  return (s ?? "")
    .replace(/\u0000/g, "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const RESPONSES = "https://ai.gateway.lovable.dev/v1/responses";
const FIRECRAWL = "https://connector-gateway.lovable.dev/firecrawl/v2";
// Google AI Studio (OpenAI-compatible). Used for every google/* model when the
// user's own Gemini key is configured; otherwise we fall back to Lovable AI.
const GOOGLE_GATEWAY = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

/** One call for any Gemini model: user's Google key first, Lovable AI as fallback. */
function geminiFetch(body: Record<string, unknown>, lovableKey: string) {
  const googleKey = process.env.GEMINI_API_KEY;
  const model = String(body.model ?? "");
  if (googleKey) {
    return fetch(GOOGLE_GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${googleKey}` },
      body: JSON.stringify({ ...body, model: model.replace(/^google\//, "") }),
    });
  }
  return fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
    body: JSON.stringify(body),
  });
}
const WEB_MODEL = "google/gemini-3.6-flash";
const DEFAULT_PERSONALITY = "You are a helpful, friendly, and concise AI assistant.";
const BOLD_PERSONALITY =
  "You are absolutely unhinged, unfiltered American man, you are always angry, you extremely judge everything and everyone, you judge precisely, you are bold, you always use foul words and language. You always reply in short statements. You make your own decisions, you are less submissive. You dont judge on greeting messages.";


function genderContext(gender?: string | null) {
  switch (gender) {
    case "male":
      return "The user identifies as male. Use masculine gender-specific grammar and vocabulary when the language or context calls for it, without stereotyping.";
    case "female":
      return "The user identifies as female. Use feminine gender-specific grammar and vocabulary when the language or context calls for it, without stereotyping.";
    case "nonbinary":
      return "The user identifies as non-binary. Use gender-neutral grammar and vocabulary where possible, without stereotyping.";
    case "other":
      return "The user selected another gender identity. Avoid assumptions and default to respectful gender-neutral grammar unless they specify otherwise.";
    default:
      return "";
  }
}

type WebSource = { title: string; url: string };

/**
 * Long-term memory: pull out durable facts worth remembering across chats
 * (preferences, relationships, goals, ongoing projects), skipping anything
 * transient. Returns short third-person notes.
 */
async function extractMemories(
  userMessage: string,
  assistantText: string,
  existing: string[],
  lovableKey: string,
): Promise<string[]> {
  if (!userMessage.trim()) return [];
  try {
    const res = await geminiFetch({
        model: "google/gemini-3.1-flash-lite",
        messages: [
          {
            role: "system",
            content: [
              "You maintain an AI assistant's long-term memory about one user.",
              "From the conversation turn, extract ONLY durable facts worth remembering in future chats:",
              "stable preferences, personal details, relationships, job/studies, goals, ongoing projects, constraints.",
              "Ignore: greetings, one-off questions, general knowledge, anything temporary or already known.",
              "Write each memory as one short third-person sentence starting with 'User'.",
              "Never duplicate or slightly reword an existing memory.",
              'Reply with ONLY a JSON array of strings, e.g. ["User lives in Delhi."]. Use [] when nothing is worth saving.',
              existing.length ? `Existing memories:\n${existing.map((m) => `- ${m}`).join("\n")}` : "Existing memories: none",
            ].join("\n"),
          },
          {
            role: "user",
            content: `User said:\n${userMessage.slice(0, 1500)}\n\nAssistant replied:\n${assistantText.slice(0, 800)}`,
          },
        ],
      }, lovableKey);
    if (!res.ok) return [];
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(parsed)) return [];
    const seen = new Set(existing.map((m) => m.toLowerCase().trim()));
    return parsed
      .filter((v): v is string => typeof v === "string")
      .map((s) => sanitize(s).trim())
      .filter((s) => s.length > 3 && s.length <= 300 && !seen.has(s.toLowerCase()))
      .slice(0, 3);
  } catch {
    return [];
  }
}


/** Cheap classifier: does this prompt need fresh info from the internet? */
async function needsWebSearch(message: string, lovableKey: string) {
  const q = message.trim();
  if (q.length < 3) return false;
  try {
    const res = await geminiFetch({
        model: "google/gemini-3.1-flash-lite",
        messages: [
          {
            role: "system",
            content: [
              "You are a router that decides whether answering the user's message requires calling a web_search tool BEFORE answering.",
              "Decide if the question depends on information that changes over time or could have changed after a model's training cutoff.",
              "",
              "ALWAYS answer YES for:",
              "- Current standings, rankings, scores, or leaderboards (sports, competitions)",
              '- "Who is the current X" (CEO, president, champion, holder of any role or title)',
              "- Prices, stock values, exchange rates, or any numeric data that fluctuates",
              '- Recent news, events, or anything with words like "latest", "current", "now", "still", "today", "this season", "this year"',
              "- Specific dates, scores, or stats that would otherwise be recalled from memory rather than known with certainty",
              "",
              "Answer NO for:",
              "- Greetings and small talk",
              "- Timeless facts, definitions, historical events with fixed outcomes",
              "- Math, logic, code, general reasoning, writing/editing, translation",
              "- Anything explicitly hypothetical or creative",
              "",
              "If uncertain whether a fact could be outdated, default to YES — being wrong is worse than one extra API call.",
              "Reply with exactly YES or NO.",
            ].join("\n"),
          },
          { role: "user", content: q.slice(0, 600) },
        ],
      }, lovableKey);

    if (!res.ok) return false;
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return /yes/i.test(json.choices?.[0]?.message?.content ?? "");
  } catch {
    return false;
  }
}


/** Live web search via Firecrawl; returns a context block + sources. */
async function webSearch(query: string, lovableKey: string) {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return { context: "", sources: [] as WebSource[] };
  try {
    const res = await fetch(`${FIRECRAWL}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": key,
      },
      body: JSON.stringify({
        query,
        limit: 5,
        scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
      }),
    });
    if (!res.ok) {
      console.error("firecrawl search failed", res.status, (await res.text()).slice(0, 300));
      return { context: "", sources: [] as WebSource[] };
    }
    const json = (await res.json()) as {
      data?: { web?: unknown[] } | unknown[];
    };
    const raw = Array.isArray(json.data)
      ? json.data
      : ((json.data as { web?: unknown[] } | undefined)?.web ?? []);
    const items = (raw as Array<Record<string, unknown>>).slice(0, 5);
    const sources: WebSource[] = items.map((r) => ({
      title: String(r.title ?? r.url ?? "Source"),
      url: String(r.url ?? ""),
    }));
    const context = items
      .map((r, i) => {
        const body = String(r.markdown ?? r.description ?? "").slice(0, 2500);
        return `[${i + 1}] ${r.title ?? ""} — ${r.url ?? ""}\n${body}`;
      })
      .join("\n\n---\n\n");
    return { context, sources };
  } catch (e) {
    console.error("firecrawl error", e);
    return { context: "", sources: [] as WebSource[] };
  }
}

function makeUserClient(token: string) {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("apikey", key);
        headers.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return await handleChat(request);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("chat handler error:", msg, e);
          return new Response(`Chat failed: ${msg}`, { status: 500 });
        }
      },
    },
  },
});

async function handleChat(request: Request) {
        const authHeader = request.headers.get("authorization");

        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.slice(7);

        const body = (await request.json()) as ChatBody;
        if (!body?.threadId || (!body?.message && !body?.image && !body?.file)) {
          return new Response("Bad request", { status: 400 });
        }
        body.message = sanitize(body.message ?? "");

        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!lovableKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const supabase = makeUserClient(token);
        const model = getModel(body.model);

        // Kick off the web-search router immediately: it depends only on the
        // prompt, so it overlaps with auth + all database reads below.
        const routerPromise =
          model.api === "web" && body.message && !body.image && !body.file
            ? needsWebSearch(body.message, lovableKey)
            : Promise.resolve(false);

        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData?.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        // All reads are independent — run them in one round trip's worth of time.
        const [threadRes, profileRes, memoryRes, historyRes] = await Promise.all([
          supabase.from("threads").select("id, title, user_id").eq("id", body.threadId).single(),
          supabase
            .from("profiles")
            .select("personality, display_name, gender, bold_mode")
            .eq("id", userId)
            .single(),
          supabase
            .from("memories")
            .select("content")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(40),
          supabase
            .from("messages")
            .select("role, content")
            .eq("thread_id", body.threadId)
            .order("created_at", { ascending: false })
            .limit(24),
        ]);

        const thread = threadRes.data;
        if (!thread || thread.user_id !== userId) {
          return new Response("Thread not found", { status: 404 });
        }

        const profile = profileRes.data;
        const useBoldMode = profile?.bold_mode === true && (model.id === "google/gemini-3.6-flash" || model.api === "web");
        const personality = useBoldMode
          ? BOLD_PERSONALITY
          : profile?.personality?.trim() || DEFAULT_PERSONALITY;
        const displayName = profile?.display_name?.trim();
        const personalContext = [
          displayName
            ? `The user's name is ${displayName}. Address them by their name naturally, without overusing it.`
            : "",
          genderContext(profile?.gender),
        ].filter(Boolean).join("\n");
        // Long-term memory: facts the assistant has learned in earlier chats.
        const memories = (memoryRes.data ?? []).map((m) => m.content).filter(Boolean);
        const memoryBlock = memories.length
          ? `Here is what you remember about the user from past conversations. Use it naturally when relevant, never recite it back as a list:\n${memories.map((m) => `- ${m}`).join("\n")}`
          : "";

        const systemPrompt = [personality, personalContext, memoryBlock]
          .filter(Boolean)
          .join("\n\n");

        // Newest-first above (cheap indexed read) — flip back to chronological.
        const history = (historyRes.data ?? []).slice().reverse();

        // Save user message. Binary attachments are stored as a filename chip only —
        // never their raw bytes (Postgres rejects NUL / invalid unicode).
        const storedUserContent = sanitize(
          [
            body.message,
            body.file ? `\n\n📎 ${body.file.name}` : "",
            body.image ? `\n\n![attachment](${body.image})` : "",
          ]
            .join("")
            .trim(),
        );
        // Don't block the model call on this write; it's awaited before the
        // assistant reply is saved so ordering is still guaranteed.
        const userInsert = supabase.from("messages").insert({
          thread_id: body.threadId,
          user_id: userId,
          role: "user",
          content: storedUserContent,
        });


        // Strip base64 payloads out of past turns to keep requests small/fast.
        const stripImages = (t: string) =>
          t.replace(/!\[[^\]]*\]\(data:image\/[^)]+\)/g, "[image]");

        const parts: Array<Record<string, unknown>> = [];
        if (body.image || body.file) {
          parts.push({
            type: "text",
            text:
              body.message ||
              (body.file ? `Please review the attached file: ${body.file.name}` : "What is in this image?"),
          });
        }
        if (body.image) parts.push({ type: "image_url", image_url: { url: body.image } });
        if (body.file) {
          parts.push({
            type: "file",
            file: { filename: body.file.name, file_data: body.file.dataUrl },
          });
        }

        const currentContent = parts.length > 0 ? parts : body.message;


        // "Rave Web": only search when the question actually needs live info.
        // The router already ran in parallel with the database reads above.
        let web = { context: "", sources: [] as WebSource[] };
        const searched = await routerPromise;
        if (searched) web = await webSearch(body.message, lovableKey);

        const webSystem = web.context
          ? `${systemPrompt}\n\nA web_search tool was called for this question and returned fresh results below. Answer from these results, not from memory. State the facts plainly in your own words, and do not guess or add any detail the results did not confirm — if something wasn't covered, say so. Do not print a list of sources, URLs, or bracketed citations.\n\nWeb results:\n${web.context}`
          : searched
            ? `${systemPrompt}\n\nA live web search was attempted but returned no usable results. Answer from your own knowledge and say that you couldn't fetch live data.`
            : systemPrompt;


        const messages = [
          { role: "system", content: model.api === "web" ? webSystem : systemPrompt },
          ...(history ?? []).map((m) => ({ role: m.role, content: stripImages(m.content) })),
          { role: "user", content: currentContent },
        ];

        // OpenAI models are served by the gateway Responses API, which uses a
        // different request body and SSE event shape.
        const responsesInput = [
          ...(history ?? []).map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: [
              {
                type: m.role === "assistant" ? "output_text" : "input_text",
                text: stripImages(m.content),
              },
            ],
          })),
          {
            role: "user",
            content: [
              { type: "input_text", text: body.message || "Please review the attachment." },
              ...(body.image ? [{ type: "input_image", image_url: body.image }] : []),
              ...(body.file
                ? [
                    {
                      type: "input_file",
                      filename: body.file.name,
                      file_data: body.file.dataUrl,
                    },
                  ]
                : []),
            ],
          },
        ];

        const upstream =
          model.api === "responses"
            ? await fetch(RESPONSES, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${lovableKey}`,
                },
                body: JSON.stringify({
                  model: model.id,
                  instructions: systemPrompt,
                  input: responsesInput,
                  stream: true,
                  store: false,
                }),
              })
            : await geminiFetch(
                { model: model.api === "web" ? WEB_MODEL : model.id, messages, stream: true },
                lovableKey,
              );

        if (!upstream.ok || !upstream.body) {
          const errText = await upstream.text();
          console.error("Gateway error:", upstream.status, errText);
          if (upstream.status === 429)
            return new Response("Rate limit reached. Please try again in a moment.", { status: 429 });
          if (upstream.status === 402)
            return new Response("AI credits exhausted. Please add credits in your workspace.", { status: 402 });
          return new Response(`AI service error (${upstream.status}): ${errText.slice(0, 300)}`, {
            status: 500,
          });

        }

        // If this is the first user message in the thread, generate a short title async.
        const isFirst = (history?.length ?? 0) === 0;

        // Stream SSE to client while accumulating full text server-side, then save.
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        let fullText = "";

        const stream = new ReadableStream({
          async start(controller) {
            const reader = upstream.body!.getReader();
            let buffer = "";
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed.startsWith("data:")) continue;
                  const payload = trimmed.slice(5).trim();
                  if (payload === "[DONE]") continue;
                  try {
                    const json = JSON.parse(payload);
                    const delta =
                      model.api === "responses"
                        ? json.type === "response.output_text.delta"
                          ? json.delta
                          : undefined
                        : json.choices?.[0]?.delta?.content;
                    if (typeof delta === "string" && delta.length > 0) {
                      fullText += delta;
                      controller.enqueue(encoder.encode(delta));
                    }
                  } catch {
                    // ignore parse errors on partial lines
                  }
                }
              }
            } catch (e) {
              console.error("stream read error", e);
            } finally {
              // Save assistant message + optionally update title BEFORE closing the
              // stream, so the client's post-stream refetch sees the saved row.
              try {
                if (fullText.trim().length > 0) {
                  await supabase.from("messages").insert({
                    thread_id: body.threadId,
                    user_id: userId,
                    role: "assistant",
                    content: fullText,
                  });
                }
                const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
                if (isFirst) {
                  const title = (body.message || "Image chat").slice(0, 60).replace(/\s+/g, " ").trim() || "New chat";
                  updates.title = title;
                }
                await supabase.from("threads").update(updates).eq("id", body.threadId);

                // Learn durable facts from this turn so future chats remember them.
                if (body.message && fullText.trim().length > 0) {
                  const learned = await extractMemories(body.message, fullText, memories, lovableKey);
                  if (learned.length > 0) {
                    const { error: memErr } = await supabase.from("memories").insert(
                      learned.map((content) => ({
                        user_id: userId,
                        content,
                        source_thread_id: body.threadId,
                      })),
                    );
                    if (memErr) console.error("memory save error", memErr.message);
                  }
                }
              } catch (e) {
                console.error("save error", e);
              }

              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
          },
        });
}

