import "server-only";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions";
export const GROQ_MODEL = "openai/gpt-oss-20b";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export function extractJSON(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    return raw.slice(firstBrace, lastBrace + 1);
  }
  return raw.trim();
}

async function callGroq(
  messages: ChatMessage[],
  opts: ChatOptions,
): Promise<string> {
  const isReasoning = GROQ_MODEL.startsWith("openai/gpt-oss");

  const response = await fetch(GROQ_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: opts.temperature ?? (isReasoning ? 0.6 : 0),
      // GPT-OSS reasoning models reject `max_tokens`; they require
      // `max_completion_tokens` instead.
      ...(isReasoning
        ? { max_completion_tokens: opts.maxTokens ?? 1024 }
        : { max_tokens: opts.maxTokens ?? 300 }),
      ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Groq API error: ${response.status} ${body}`);
  }

  const data = await response.json();
  if (!data.choices || data.choices.length === 0) {
    throw new Error("Groq returned no choices");
  }
  return data.choices[0].message.content.trim() as string;
}

export async function chatJSON<T>(
  messages: ChatMessage[],
  opts: ChatOptions = {},
): Promise<T> {
  const raw = await callGroq(messages, { ...opts, jsonMode: true });
  return JSON.parse(extractJSON(raw)) as T;
}

export async function chatText(
  messages: ChatMessage[],
  opts: ChatOptions = {},
): Promise<string> {
  return callGroq(messages, opts);
}
