import { NextResponse } from "next/server";
import { streamText, convertToCoreMessages, type Message } from "ai";
import { eq, count } from "drizzle-orm";
import { nanoid } from "nanoid";
import { nanogpt } from "@/lib/nanogpt";
import { searxngSearch, formatSearchContext, webSearchTool, type SearchResponse } from "@/lib/search";
import { SEARCH_ONLY_SYSTEM_PROMPT } from "@/lib/prompts";
import { db, conversations, messages as messagesTable } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { generateTitle } from "@/lib/title";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatRequest = {
  messages: Message[];
  model: string;
  conversationId?: string;
};

function shouldPreSearch(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 4) return false;
  const lower = trimmed.toLowerCase();
  const greetings = ["hi", "hello", "hey", "yo", "thanks", "thank you", "ok", "okay", "cool", "nice"];
  if (greetings.includes(lower)) return false;
  return true;
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

  console.log(`[chat] model=${model} userText="${userText.slice(0, 60)}"`);

  // Pre-search: ground the model with fresh web context before it speaks.
  let preSearch: SearchResponse | null = null;
  if (shouldPreSearch(userText)) {
    const t0 = Date.now();
    try {
      preSearch = await searxngSearch(userText, { maxResults: 6 });
      console.log(`[chat] pre-search ok in ${Date.now() - t0}ms (${preSearch.results.length} results)`);
    } catch (err) {
      console.error(`[chat] pre-search failed in ${Date.now() - t0}ms:`, err instanceof Error ? err.message : err);
    }
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

  const systemMessages = [{ role: "system" as const, content: SEARCH_ONLY_SYSTEM_PROMPT }];
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

  const result = streamText({
    model: provider(model),
    system: undefined,
    messages: [...systemMessages, ...coreMessages],
    tools: { web_search: webSearchTool },
    maxSteps: 3,
    onStepFinish: ({ toolResults }) => {
      for (const tr of toolResults ?? []) {
        if (tr.toolName === "web_search" && tr.result && typeof tr.result === "object") {
          const r = tr.result as { results?: { title: string; url: string }[] };
          for (const item of r.results ?? []) {
            if (!citations.some((c) => c.url === item.url)) {
              citations.push({ title: item.title, url: item.url });
            }
          }
        }
      }
    },
    onFinish: async ({ text }) => {
      db.insert(messagesTable)
        .values({
          id: nanoid(),
          conversationId,
          role: "assistant",
          content: text,
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
      if ((row?.n ?? 0) === 2) {
        generateTitle(userText, text)
          .then((title) => {
            db.update(conversations)
              .set({ title, updatedAt: new Date() })
              .where(eq(conversations.id, conversationId))
              .run();
          })
          .catch((e) => console.error("title generation failed", e));
      }
    },
  });

  return result.toDataStreamResponse({
    headers: {
      "x-conversation-id": conversationId,
    },
    getErrorMessage: (error) => {
      console.error("chat stream error", error);
      if (error instanceof Error) return error.message;
      return "Something went wrong while talking to the model.";
    },
  });
}
