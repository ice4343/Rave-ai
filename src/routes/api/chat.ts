import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type ChatBody = {
  threadId: string;
  message: string;
  image?: string | null;
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

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
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.slice(7);

        const body = (await request.json()) as ChatBody;
        if (!body?.threadId || (!body?.message && !body?.image)) {
          return new Response("Bad request", { status: 400 });
        }

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
        const storedUserContent = body.image
          ? `${body.message}\n\n![attachment](${body.image})`.trim()
          : body.message;
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

        const currentContent = body.image
          ? [
              { type: "text", text: body.message || "What is in this image?" },
              { type: "image_url", image_url: { url: body.image } },
            ]
          : body.message;

        const messages = [
          { role: "system", content: systemPrompt },
          ...(history ?? []).map((m) => ({ role: m.role, content: stripImages(m.content) })),
          { role: "user", content: currentContent },
        ];

        const upstream = await fetch(GATEWAY, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableKey}`,
          },
          body: JSON.stringify({ model: MODEL, messages, stream: true }),
        });

        if (!upstream.ok || !upstream.body) {
          const errText = await upstream.text();
          console.error("Gateway error:", upstream.status, errText);
          if (upstream.status === 429)
            return new Response("Rate limit reached. Please try again in a moment.", { status: 429 });
          if (upstream.status === 402)
            return new Response("AI credits exhausted. Please add credits in your workspace.", { status: 402 });
          return new Response("AI service error", { status: 500 });
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
                    const delta = json.choices?.[0]?.delta?.content;
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
      },
    },
  },
});
