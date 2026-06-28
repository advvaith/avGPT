import { NextResponse } from "next/server";
import {
  streamText,
  convertToCoreMessages,
  createDataStreamResponse,
  type DataStreamWriter,
  type Message,
} from "ai";
import { eq, count } from "drizzle-orm";
import { nanoid } from "nanoid";
import { nanogpt } from "@/lib/nanogpt";
import {
  parallelSearxngSearch,
  formatSearchContext,
  createWebSearchTool,
  type SearchResponse,
} from "@/lib/search";
import { buildSystemPrompt } from "@/lib/prompts";
import { db, conversations, messages as messagesTable } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { generateTitle } from "@/lib/title";
import { clampSettings, type SearchSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatRequest = {
  messages: Message[];
  model: string;
  conversationId?: string;
  settings?: Partial<SearchSettings>;
};

type SearchDecision = "skip" | "search";

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function classifySearchNeed(text: string): SearchDecision {
  const trimmed = text.trim();
  if (trimmed.length < 4) return "skip";
  const lower = trimmed.toLowerCase();

  const greetings = [
    "hi",
    "hello",
    "hey",
    "yo",
    "thanks",
    "thank you",
    "ok",
    "okay",
    "cool",
    "nice",
  ];
  if (greetings.includes(lower)) return "skip";

  const explicitFreshnessTerms = [
    "latest",
    "current",
    "currently",
    "today",
    "tonight",
    "this morning",
    "this week",
    "this month",
    "this year",
    "recent",
    "recently",
    "newest",
    "up to date",
    "up-to-date",
    "now",
    "as of",
    "2025",
    "2026",
  ];
  if (includesAny(lower, explicitFreshnessTerms)) return "search";

  const apiDocTerms = [
    "api",
    "sdk",
    "docs",
    "documentation",
    "library",
    "package",
    "framework",
    "dependency",
    "endpoint",
    "route handler",
    "app router",
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
    "github api",
  ];
  const codingActionPatterns = [
    /\b(code|coding|implement|build|create|add|fix|debug|migrate|upgrade|install|configure|integrate|use|using|example)\b/,
    /\b(npm|pnpm|yarn|pip|cargo|go get|import|from\s+\S+\s+import)\b/,
  ];
  if (includesAny(lower, apiDocTerms) && matchesAny(lower, codingActionPatterns)) {
    return "search";
  }

  const writingOrReasoningPatterns = [
    /\b(rewrite|draft|write|summarize|summarise|polish|translate|explain|brainstorm|outline|compose)\b/,
    /\b(regex|regular expression|sql query|pseudocode)\b/,
  ];
  if (matchesAny(lower, writingOrReasoningPatterns)) return "skip";

  const factualWorldPatterns = [
    /\b(who|when|where|how many|how much|which)\b/,
    /\b(price|cost|stock|weather|schedule|score|law|regulation|rule|release|version|spec|specs|ceo|president|prime minister|election|news|event|deadline)\b/,
  ];
  if (matchesAny(lower, factualWorldPatterns)) return "search";

  return "skip";
}

function buildPreSearchQueries(text: string): string[] {
  const trimmed = text.trim();
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
  if (includesAny(lower, docsTerms)) {
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
  if (includesAny(lower, freshnessTerms)) {
    queries.push(`${trimmed} latest`);
  }

  return queries.slice(0, 4);
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as ChatRequest;
  const { messages, model } = body;
  if (!messages?.length || !model) {
    return NextResponse.json({ error: "messages and model required" }, { status: 400 });
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) {
    return NextResponse.json({ error: "no user message" }, { status: 400 });
  }

  const userText = typeof lastUser.content === "string" ? lastUser.content : "";

  const settings = clampSettings(body.settings);

  const searchDecision: "search" | "skip" =
    settings.preSearchMode === "always"
      ? "search"
      : settings.preSearchMode === "never"
        ? "skip"
        : classifySearchNeed(userText);

  console.log(
    `[chat] model=${model} search=${searchDecision} mode=${settings.preSearchMode} steps=${settings.maxSteps} maxResults=${settings.maxResults} userText="${userText.slice(0, 60)}"`,
  );

  // Pre-search: ground the model with fresh web context before it speaks.
  let preSearch: SearchResponse | null = null;
  if (searchDecision === "search") {
    const searchQueries = buildPreSearchQueries(userText);
    const t0 = Date.now();
    try {
      preSearch = await parallelSearxngSearch(searchQueries, { maxResults: settings.maxResults });
      console.log(
        `[chat] pre-search ok in ${Date.now() - t0}ms (${preSearch.results.length} results, ${searchQueries.length} queries)`,
      );
    } catch (err) {
      console.error(`[chat] pre-search failed in ${Date.now() - t0}ms:`, err instanceof Error ? err.message : err);
    }
  } else {
    console.log("[chat] pre-search skipped");
  }

  const conversationId = body.conversationId ?? nanoid();
  const isNew = !body.conversationId;

  if (isNew) {
    db.insert(conversations)
      .values({
        id: conversationId,
        title: userText.slice(0, 80) || "New chat",
        model,
      })
      .run();
  } else {
    db.update(conversations)
      .set({ model, updatedAt: new Date() })
      .where(eq(conversations.id, conversationId))
      .run();
  }

  // Persist the user message immediately so a refresh-mid-stream isn't lossy.
  db.insert(messagesTable)
    .values({
      id: nanoid(),
      conversationId,
      role: "user",
      content: userText,
    })
    .run();

  const systemMessages = [{ role: "system" as const, content: buildSystemPrompt() }];
  if (preSearch) {
    systemMessages.push({
      role: "system" as const,
      content: formatSearchContext(preSearch),
    });
  }

  const provider = nanogpt();
  const coreMessages = convertToCoreMessages(messages);

  const citations: { title: string; url: string }[] = preSearch
    ? preSearch.results.map((r) => ({ title: r.title, url: r.url }))
    : [];

  // Capture the data stream once `execute` runs so that tool-call citations
  // discovered later via onStepFinish can be streamed as live `source` parts.
  let dataStreamRef: DataStreamWriter | null = null;

  function pushCitation(item: { title: string; url: string }) {
    if (!item.url) return;
    if (citations.some((c) => c.url === item.url)) return;
    citations.push({ title: item.title || item.url, url: item.url });
    dataStreamRef?.writeSource({
      sourceType: "url",
      id: String(citations.length),
      title: item.title || item.url,
      url: item.url,
    });
  }

  const toolingResult = streamText({
    model: provider(model),
    system: undefined,
    messages: [...systemMessages, ...coreMessages],
    tools: { web_search: createWebSearchTool({ maxResults: settings.maxResults }) },
    maxSteps: settings.maxSteps,
    onStepFinish: ({ toolResults }) => {
      for (const tr of toolResults ?? []) {
        if (tr.toolName !== "web_search") continue;
        const r = tr.result as
          | { results?: { title?: string; url?: string }[] }
          | undefined;
        for (const item of r?.results ?? []) {
          if (item.url) {
            pushCitation({ title: item.title ?? item.url, url: item.url });
          }
        }
      }
    },
  });

  return createDataStreamResponse({
    headers: {
      "x-conversation-id": conversationId,
    },
    execute: async (dataStream) => {
      dataStreamRef = dataStream;

      // Pre-search citations land first so the UI shows them while the model
      // is still thinking.
      for (const [index, citation] of citations.entries()) {
        dataStream.writeSource({
          sourceType: "url",
          id: String(index + 1),
          title: citation.title,
          url: citation.url,
        });
      }

      toolingResult.mergeIntoDataStream(dataStream);
      const firstText = (await toolingResult.text).trim();

      let finalText = firstText;

      // Fallback: thinking models often spend their entire step budget on
      // parallel tool calls and never write prose. If the first stream ended
      // without any visible text, force a second turn with tools disabled so
      // the model is obligated to synthesize from the search results it has.
      if (!firstText) {
        console.log("[chat] tooling phase returned no text — running synthesis fallback");
        const priorMessages = (await toolingResult.response).messages;
        const synthesis = streamText({
          model: provider(model),
          messages: [
            ...systemMessages,
            ...coreMessages,
            ...priorMessages,
            {
              role: "system",
              content:
                "You have already gathered enough search results above. Stop searching. Now write your final answer to the user, citing sources inline as [1], [2], etc. Do not call any tools.",
            },
          ],
        });
        synthesis.mergeIntoDataStream(dataStream);
        finalText = (await synthesis.text).trim();
      }

      // Persist the assistant turn once we know what the final text actually is.
      db.insert(messagesTable)
        .values({
          id: nanoid(),
          conversationId,
          role: "assistant",
          content: finalText,
          citations: citations.length ? JSON.stringify(citations) : null,
        })
        .run();
      db.update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversationId))
        .run();

      // Auto-title after the first turn (1 user + 1 assistant just inserted).
      // Fire-and-forget — don't block the response on the title-model call.
      const row = db
        .select({ n: count() })
        .from(messagesTable)
        .where(eq(messagesTable.conversationId, conversationId))
        .get();
      if ((row?.n ?? 0) === 2 && finalText) {
        generateTitle(userText, finalText)
          .then((title) => {
            db.update(conversations)
              .set({ title, updatedAt: new Date() })
              .where(eq(conversations.id, conversationId))
              .run();
          })
          .catch((e) => console.error("title generation failed", e));
      }
    },
    onError: (error: unknown) => {
      console.error("chat stream error", error);
      if (error instanceof Error) return error.message;
      return "Something went wrong while talking to the model.";
    },
  });
}
