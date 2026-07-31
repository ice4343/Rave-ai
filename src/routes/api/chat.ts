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
        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData?.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        // Verify thread ownership
        const { data: thread } = await supabase
          .from("threads")
          .select("id, title, user_id")
          .eq("id", body.threadId)
          .single();
        if (!thread || thread.user_id !== userId) {
          return new Response("Thread not found", { status: 404 });
        }

        // Load personality + history
        const { data: profile } = await supabase
          .from("profiles")
          .select("personality, display_name")
          .eq("id", userId)
          .single();
        const personality =
          profile?.personality?.trim() ||
          "You are a helpful, friendly, and concise AI assistant.";
        const displayName = profile?.display_name?.trim();
        const systemPrompt = displayName
          ? `${personality}\n\nThe user's name is ${displayName}. Address them by their name naturally, without overusing it.`
          : personality;

        const { data: history } = await supabase
          .from("messages")
          .select("role, content")
          .eq("thread_id", body.threadId)
          .order("created_at", { ascending: true });

        // Save user message (attachment stored inline as markdown so it renders)
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
        const { error: insertErr } = await supabase.from("messages").insert({
          thread_id: body.threadId,
          user_id: userId,
          role: "user",
          content: storedUserContent,
        });
        if (insertErr) return new Response(insertErr.message, { status: 500 });

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


        const model = getModel(body.model);

        const messages = [
          { role: "system", content: systemPrompt },
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

        const upstream = await fetch(model.api === "responses" ? RESPONSES : GATEWAY, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableKey}`,
          },
          body: JSON.stringify(
            model.api === "responses"
              ? {
                  model: model.id,
                  instructions: systemPrompt,
                  input: responsesInput,
                  stream: true,
                  store: false,
                }
              : { model: model.id, messages, stream: true },
          ),
        });

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

