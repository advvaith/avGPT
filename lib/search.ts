import { tool } from "ai";
import { z } from "zod";

export type SearchResult = {
  title: string;
  url: string;
  content: string;
  score?: number;
  publishedDate?: string;
};

export type SearchResponse = {
  query: string;
  answer?: string;
  results: SearchResult[];
};

/**
 * SearXNG JSON API. The instance must have `formats: [html, json]` enabled in
 * its settings.yml — see README. Default points at the bundled docker service.
 */
const DEFAULT_SEARXNG_URL = "http://localhost:8080";

function searxngBase(): string {
  return (process.env.SEARXNG_URL ?? DEFAULT_SEARXNG_URL).replace(/\/$/, "");
}

export async function searxngSearch(
  query: string,
  opts: { maxResults?: number; topic?: "general" | "news" } = {},
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    safesearch: "0",
    categories: opts.topic === "news" ? "news" : "general",
    language: "en",
  });

  const headers: Record<string, string> = {
    "User-Agent": "avgpt/1.0",
  };
  if (process.env.SEARXNG_AUTH) {
    headers.Authorization = `Basic ${Buffer.from(process.env.SEARXNG_AUTH).toString("base64")}`;
  }

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 8000);
  let res: Response;
  try {
    res = await fetch(`${searxngBase()}/search?${params.toString()}`, {
      headers,
      cache: "no-store",
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    throw new Error(
      `SearXNG search failed: ${res.status} — ${await res.text().catch(() => "")}`,
    );
  }
  const data = (await res.json()) as {
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
      score?: number;
      publishedDate?: string;
      publishedAt?: string;
    }>;
  };

  const max = opts.maxResults ?? 6;
  const results: SearchResult[] = (data.results ?? [])
    .filter((r) => r.url && r.title)
    .slice(0, max)
    .map((r) => ({
      title: r.title!,
      url: r.url!,
      content: r.content ?? "",
      score: r.score,
      publishedDate: r.publishedDate ?? r.publishedAt,
    }));

  return { query, results };
}

/** Format search results so the model treats them as the only allowed source. */
export function formatSearchContext(resp: SearchResponse): string {
  const lines: string[] = [];
  lines.push(`# Live web search results for: ${resp.query}`);
  lines.push("");
  if (resp.answer) {
    lines.push(`> Summary: ${resp.answer}`);
    lines.push("");
  }
  resp.results.forEach((r, i) => {
    lines.push(`[${i + 1}] ${r.title}`);
    lines.push(`URL: ${r.url}`);
    if (r.publishedDate) lines.push(`Published: ${r.publishedDate}`);
    if (r.content) lines.push(r.content);
    lines.push("");
  });
  lines.push(
    "End of search results. Cite sources inline as [1], [2], etc. If insufficient, call the web_search tool with a refined query.",
  );
  return lines.join("\n");
}

/** AI SDK tool the model can call mid-response for follow-up searches. */
export const webSearchTool = tool({
  description:
    "Search the live web for up-to-date information. Use this whenever you need facts you cannot ground in already-retrieved results. Returns titles, URLs, and snippets.",
  parameters: z.object({
    query: z.string().describe("The web search query — be specific and keyword-rich."),
    topic: z
      .enum(["general", "news"])
      .optional()
      .describe("Use 'news' for very recent events; otherwise 'general'."),
  }),
  execute: async ({ query, topic }) => {
    try {
      const resp = await searxngSearch(query, { topic, maxResults: 6 });
      return {
        query: resp.query,
        summary: null,
        results: resp.results.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.content,
          publishedDate: r.publishedDate ?? null,
        })),
      };
    } catch (err) {
      return {
        query,
        error: `Search failed: ${err instanceof Error ? err.message : String(err)}. The search backend may be unavailable.`,
        results: [],
      };
    }
  },
});
