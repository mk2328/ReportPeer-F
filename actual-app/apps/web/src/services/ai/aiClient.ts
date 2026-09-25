/**
 * Server-only OpenAI-compatible chat client (Groq endpoint).
 * Keys must never be exposed to the browser.
 */

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export class AiClientError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "AiClientError";
    this.status = status;
  }
}

function resolveConfig() {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new AiClientError(
      "GROQ_API_KEY is not configured on the server. Add it to apps/web/.env.local.",
      503
    );
  }
  const baseUrl = (process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1").replace(
    /\/$/,
    ""
  );
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  return { apiKey, baseUrl, model };
}

/** Non-streaming chat completion via OpenAI-compatible HTTP API. */
export async function createChatCompletion(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const { apiKey, baseUrl, model } = resolveConfig();

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.4,
      max_tokens: options?.maxTokens ?? 1200,
    }),
  });

  const raw = await response.text();
  let payload: any = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail =
      payload?.error?.message ||
      payload?.message ||
      raw.slice(0, 240) ||
      `HTTP ${response.status}`;
    throw new AiClientError(`AI provider error: ${detail}`, response.status >= 400 ? response.status : 502);
  }

  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new AiClientError("AI provider returned an empty draft.", 502);
  }
  return text.trim();
}
