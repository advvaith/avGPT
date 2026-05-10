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

type SearchOptions = {
  maxResults?: number;
  topic?: "general" | "news";
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
  opts: SearchOptions = {},
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

function uniqueQueries(queries: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const query of queries) {
    const trimmed = query.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    unique.push(trimmed);
  }
  return unique;
}

function mergeSearchResponses(
  query: string,
  responses: SearchResponse[],
  maxResults: number,
): SearchResponse {
  const seenUrls = new Set<string>();
  const results: SearchResult[] = [];
  const maxResponseLength = Math.max(0, ...responses.map((resp) => resp.results.length));

  for (let rank = 0; rank < maxResponseLength && results.length < maxResults; rank += 1) {
    for (const resp of responses) {
      const result = resp.results[rank];
      if (!result || seenUrls.has(result.url)) continue;
      seenUrls.add(result.url);
      results.push(result);
      if (results.length >= maxResults) break;
    }
  }

  return { query, results };
}

export async function parallelSearxngSearch(
  queries: string[],
  opts: SearchOptions = {},
): Promise<SearchResponse> {
  const unique = uniqueQueries(queries);
  if (unique.length === 0) return { query: "", results: [] };
  if (unique.length === 1) return searxngSearch(unique[0], opts);

  const settled = await Promise.allSettled(
    unique.map((query) => searxngSearch(query, opts)),
  );
  const responses = settled
    .filter((result): result is PromiseFulfilledResult<SearchResponse> => result.status === "fulfilled")
    .map((result) => result.value);

  if (responses.length === 0) {
    const firstError = settled.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    )?.reason;
    throw firstError instanceof Error
      ? firstError
      : new Error(`All SearXNG searches failed: ${String(firstError)}`);
  }

  return mergeSearchResponses(
    unique.join(" | "),
    responses,
    (opts.maxResults ?? 6) * unique.length,
  );
}

function buildSearchQueryVariants(query: string): string[] {
  const trimmed = query.trim();
  const lower = trimmed.toLowerCase();
  const queries = [trimmed];

  const docsTerms = [
    "api",
    "sdk",
    "docs",
    "documentation",
    "library",
    "package",
    "framework",
    "endpoint",
    "openai",
    "anthropic",
    "next.js",
    "nextjs",
    "react",
    "vercel",
    "ai sdk",
    "tailwind",
    "drizzle",
    "prisma",
    "stripe",
    "supabase",
    "firebase",
  ];
  if (docsTerms.some((term) => lower.includes(term))) {
    queries.push(`${trimmed} official docs`);
    queries.push(`${trimmed} latest documentation`);
  }

  const freshnessTerms = [
    "latest",
    "current",
    "currently",
    "today",
    "tonight",
    "recent",
    "recently",
    "newest",
    "up to date",
    "up-to-date",
  ];
  if (freshnessTerms.some((term) => lower.includes(term))) {
    queries.push(`${trimmed} latest`);
  }

  return queries.slice(0, 4);
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
    "End of search results. Cite sources inline as [1], [2], etc. If the results are insufficient, say what is missing instead of guessing.",
  );
  return lines.join("\n");
}

/** AI SDK tool the model can call mid-response for follow-up searches. */
export function createWebSearchTool(opts: { maxResults?: number } = {}) {
  const maxResults = opts.maxResults ?? 6;
  return tool({
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
      const searchQueries = buildSearchQueryVariants(query);
      try {
        const resp = await parallelSearxngSearch(searchQueries, { topic, maxResults });
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
}

/** Default instance for callers that don't need per-request configuration. */
export const webSearchTool = createWebSearchTool();
