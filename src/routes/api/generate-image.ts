import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash-image";

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

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.slice(7);

        const body = (await request.json()) as {
          threadId: string;
          prompt: string;
          baseImage?: string | null;
        };
        if (!body?.threadId || !body?.prompt) {
          return new Response("Bad request", { status: 400 });
        }


        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!lovableKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const supabase = makeUserClient(token);
        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData?.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        const { data: thread } = await supabase
          .from("threads")
          .select("id, user_id")
          .eq("id", body.threadId)
          .single();
        if (!thread || thread.user_id !== userId) {
          return new Response("Thread not found", { status: 404 });
        }

        // Save user prompt as a message
        await supabase.from("messages").insert({
          thread_id: body.threadId,
          user_id: userId,
          role: "user",
          content: `🎨 ${body.prompt}`,
        });

        const { data: history } = await supabase
          .from("messages")
          .select("id")
          .eq("thread_id", body.threadId)
          .limit(2);
        const isFirst = (history?.length ?? 0) <= 1;

        const upstream = await fetch(GATEWAY, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableKey}`,
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              {
                role: "user",
                content: body.baseImage
                  ? [
                      {
                        type: "text",
                        text: `Edit the attached image: ${body.prompt}. Keep everything else in the image — the subject's identity, pose, clothing, lighting, background and style — exactly the same, and apply only the requested change. Return the edited image.`,
                      },
                      { type: "image_url", image_url: { url: body.baseImage } },
                    ]
                  : body.prompt,
              },
            ],
            modalities: ["image", "text"],
          }),

        });

        if (!upstream.ok) {
          const errText = await upstream.text();
          console.error("Image gateway error:", upstream.status, errText);
          if (upstream.status === 429)
            return new Response("Rate limit reached. Please try again shortly.", { status: 429 });
          if (upstream.status === 402)
            return new Response("AI credits exhausted. Please add credits in your workspace.", { status: 402 });
          return new Response("Image service error", { status: 500 });
        }

        const json = (await upstream.json()) as {
          choices?: Array<{
            message?: {
              content?: string;
              images?: Array<{ image_url?: { url?: string } | string }>;
            };
          }>;
        };

        // Extract a data URL from the response, tolerating shape variants.
        let dataUrl: string | null = null;
        const msg = json.choices?.[0]?.message;
        if (msg?.images && msg.images.length > 0) {
          const first = msg.images[0];
          const url =
            typeof first === "string"
              ? first
              : typeof first?.image_url === "string"
                ? first.image_url
                : first?.image_url?.url;
          if (typeof url === "string" && url.startsWith("data:")) dataUrl = url;
          else if (typeof url === "string" && url.startsWith("http")) dataUrl = url;
        }
        if (!dataUrl && typeof msg?.content === "string") {
          const match = msg.content.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/);
          if (match) dataUrl = match[0];
        }

        if (!dataUrl) {
          console.error("No image in response", JSON.stringify(json).slice(0, 500));
          return new Response("Model returned no image", { status: 500 });
        }

        const markdown = `![${body.prompt.replace(/[\[\]]/g, "")}](${dataUrl})`;

        await supabase.from("messages").insert({
          thread_id: body.threadId,
          user_id: userId,
          role: "assistant",
          content: markdown,
        });

        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (isFirst) {
          updates.title = ("🎨 " + body.prompt).slice(0, 60);
        }
        await supabase.from("threads").update(updates).eq("id", body.threadId);

        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
