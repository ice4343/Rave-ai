// Chat models the user can switch between. Shared by the UI and /api/chat.

export type ChatModel = {
  id: string;
  name: string;
  hint: string;
  /** OpenAI models are served by the gateway Responses API. "web" = live web search first. */
  api: "chat" | "responses" | "web";
};

export const CHAT_MODELS: ChatModel[] = [
  {
    id: "google/gemini-3.6-flash",
    name: "Rave Flash",
    hint: "Fastest — great for everyday chat",
    api: "chat",
  },
  {
    id: "google/gemini-3.1-pro-preview",
    name: "Rave Pro",
    hint: "Deeper reasoning, slower",
    api: "chat",
  },
  {
    id: "openai/gpt-5.6-terra",
    name: "Rave GPT",
    hint: "GPT-5.6 — balanced quality",
    api: "responses",
  },
  {
    id: "openai/gpt-5.6-sol",
    name: "Rave GPT Max",
    hint: "GPT-5.6 flagship — hardest tasks",
    api: "responses",
  },
  {
    id: "rave/web",
    name: "Rave Web",
    hint: "Searches the internet live, answers with sources",
    api: "web",
  },
];

export const DEFAULT_MODEL = CHAT_MODELS[0].id;

export function getModel(id?: string | null): ChatModel {
  return CHAT_MODELS.find((m) => m.id === id) ?? CHAT_MODELS[0];
}

const KEY = "rave.model.v1";

export function loadModel(): string {
  if (typeof window === "undefined") return DEFAULT_MODEL;
  try {
    return getModel(window.localStorage.getItem(KEY)).id;
  } catch {
    return DEFAULT_MODEL;
  }
}

export function saveModel(id: string) {
  try {
    window.localStorage.setItem(KEY, getModel(id).id);
  } catch {
    /* ignore */
  }
}
