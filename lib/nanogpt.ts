import { createOpenAI } from "@ai-sdk/openai";

export const NANOGPT_BASE_URL = "https://nano-gpt.com/api/v1";

export function nanogpt() {
  const apiKey = process.env.NANOGPT_API_KEY;
  if (!apiKey) {
    throw new Error("NANOGPT_API_KEY is not set");
  }
  return createOpenAI({
    apiKey,
    baseURL: NANOGPT_BASE_URL,
    compatibility: "compatible",
  });
}

export type NanoGPTModel = {
  id: string;
  object: string;
  created?: number;
  owned_by?: string;
  /** present on some entries; we surface to the UI when available */
  description?: string;
  pricing?: { prompt?: string; completion?: string };
};

export async function listModels(): Promise<NanoGPTModel[]> {
  const apiKey = process.env.NANOGPT_API_KEY;
  if (!apiKey) throw new Error("NANOGPT_API_KEY is not set");

  const res = await fetch(`${NANOGPT_BASE_URL}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`NanoGPT /models failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { data: NanoGPTModel[] };
  return data.data ?? [];
}
