"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { PanelLeftOpen } from "lucide-react";
import { ModelPicker } from "./ModelPicker";
import { Composer } from "./Composer";
import { Message } from "./Message";
import { EmptyHeading, EmptyStateChips } from "./EmptyState";
import { ThinkingDots } from "./ThinkingDots";
import { InterruptedBanner } from "./InterruptedBanner";
import type { ModelInfo } from "./ChatApp";

type Props = {
  conversationId: string | null;
  models: ModelInfo[];
  model: string;
  onModelChange: (id: string) => void;
  onConversationCreated: (id: string) => void;
  onTurnFinished: () => void;
  onSidebarToggle: () => void;
  sidebarOpen: boolean;
};

type StoredMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: { title: string; url: string }[] | null;
};

export function ChatPane({
  conversationId,
  models,
  model,
  onModelChange,
  onConversationCreated,
  onTurnFinished,
  onSidebarToggle,
  sidebarOpen,
}: Props) {
  // The conv id ChatPane is tracking. Initialised from prop on mount, then
  // updated *only* via the x-conversation-id header from streamed responses.
  // We never re-read the prop after mount — the parent keys us by session,
  // so a real switch unmounts and remounts us with a fresh prop.
  const [convId, setConvId] = useState<string | null>(conversationId);
  const [initialMessages, setInitialMessages] = useState<StoredMessage[] | null>(
    conversationId ? null : [],
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const announcedRef = useRef(false);

  useEffect(() => {
    if (!conversationId) return;
    (async () => {
      const res = await fetch(`/api/conversations/${conversationId}`);
      if (!res.ok) {
        setInitialMessages([]);
        return;
      }
      const data = (await res.json()) as {
        messages: StoredMessage[];
        conversation: { model: string };
      };
      setInitialMessages(data.messages);
      if (data.conversation?.model) onModelChange(data.conversation.model);
    })();
    // Run only on mount — the parent gives us a fresh key when conversationId
    // changes for real.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (initialMessages === null) {
    return (
      <main className="flex flex-1 items-center justify-center text-sm text-[var(--color-fg-muted)]">
        Loading…
      </main>
    );
  }

  return (
    <ChatPaneInner
      initialMessages={initialMessages}
      convId={convId}
      onConvIdResolved={(id) => {
        setConvId(id);
        if (announcedRef.current) return;
        announcedRef.current = true;
        onConversationCreated(id);
      }}
      onTurnFinished={onTurnFinished}
      models={models}
      model={model}
      onModelChange={onModelChange}
      onSidebarToggle={onSidebarToggle}
      sidebarOpen={sidebarOpen}
      scrollRef={scrollRef}
    />
  );
}

function ChatPaneInner({
  initialMessages,
  convId,
  onConvIdResolved,
  onTurnFinished,
  models,
  model,
  onModelChange,
  onSidebarToggle,
  sidebarOpen,
  scrollRef,
}: {
  initialMessages: StoredMessage[];
  convId: string | null;
  onConvIdResolved: (id: string) => void;
  onTurnFinished: () => void;
  models: ModelInfo[];
  model: string;
  onModelChange: (id: string) => void;
  onSidebarToggle: () => void;
  sidebarOpen: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  // useChat reads `body` via an internal ref each render, so passing the
  // current `convId`/`model` here keeps subsequent requests in sync without
  // remounting the hook. Hold a ref too for use inside onResponse, where
  // closures over state are stale.
  const convIdRef = useRef(convId);
  convIdRef.current = convId;

  const {
    messages,
    setMessages,
    input,
    setInput,
    handleSubmit,
    status,
    stop,
    reload,
    error,
  } = useChat({
    api: "/api/chat",
    initialMessages: initialMessages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      data: { citations: m.citations ?? null },
    })) as never,
    body: { model, conversationId: convId },
    onResponse: (res) => {
      const id = res.headers.get("x-conversation-id");
      if (id && !convIdRef.current) onConvIdResolved(id);
    },
    onFinish: () => {
      // Server may have just auto-titled the chat; refresh sidebar so it shows.
      // 800ms grace lets the title-model call land before we refetch.
      setTimeout(() => onTurnFinished(), 800);
    },
  });

  // Recovery: if we mounted with an orphan user message (server-side stream
  // was interrupted by a refresh), poll for the assistant response. After
  // 30s with no answer, surface a Retry banner.
  type Recovery = "idle" | "polling" | "interrupted";
  const [recovery, setRecovery] = useState<Recovery>("idle");

  useEffect(() => {
    if (initialMessages.length === 0) return;
    const last = initialMessages[initialMessages.length - 1];
    if (last.role !== "user" || !convId) return;

    setRecovery("polling");
    const start = Date.now();
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/conversations/${convId}`);
        if (res.ok) {
          const data = (await res.json()) as { messages: StoredMessage[] };
          const newLast = data.messages[data.messages.length - 1];
          if (newLast?.role === "assistant") {
            setMessages(
              data.messages.map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                data: { citations: m.citations ?? null },
              })) as never,
            );
            setRecovery("idle");
            return;
          }
        }
      } catch {
        /* ignore — keep polling */
      }
      if (Date.now() - start > 30000) {
        setRecovery("interrupted");
        return;
      }
      setTimeout(poll, 2000);
    };
    poll();

    return () => {
      cancelled = true;
    };
    // Run only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, scrollRef]);

  const isStreaming = status === "streaming" || status === "submitted";
  const showEmpty = messages.length === 0;

  const composer = (
    <Composer
      value={input}
      onChange={setInput}
      onSubmit={handleSubmit}
      onStop={stop}
      isStreaming={isStreaming}
      disabled={!model}
    />
  );

  return (
    <main className="relative flex flex-1 flex-col bg-[var(--color-bg)]">
      <header className="flex h-12 items-center gap-2 px-3">
        {!sidebarOpen && (
          <button
            aria-label="Open sidebar"
            onClick={onSidebarToggle}
            className="rounded-lg p-2 text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-fg)]"
          >
            <PanelLeftOpen size={18} />
          </button>
        )}
        <ModelPicker models={models} value={model} onChange={onModelChange} />
        <div className="flex-1" />
      </header>

      {showEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 pb-16">
          <div className="w-full max-w-3xl">
            <EmptyHeading />
            {composer}
            <EmptyStateChips onPick={(p) => setInput(p)} />
          </div>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="scrollbar-thin flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl px-4 py-6">
              {messages.map((m, i) => (
                <Message
                  key={m.id}
                  role={m.role as "user" | "assistant"}
                  content={m.content}
                  streaming={isStreaming && i === messages.length - 1 && m.role === "assistant"}
                  onRegenerate={
                    m.role === "assistant" && i === messages.length - 1
                      ? () => reload()
                      : undefined
                  }
                  toolInvocations={
                    "toolInvocations" in m
                      ? (m.toolInvocations as Array<{ toolName: string; args: unknown }>)
                      : undefined
                  }
                  initialCitations={
                    (m as unknown as { data?: { citations?: { title: string; url: string }[] } })
                      .data?.citations ?? undefined
                  }
                />
              ))}
              {(isStreaming || recovery === "polling") &&
                (messages.length === 0 ||
                  messages[messages.length - 1].role === "user") && <ThinkingDots />}
              {recovery === "interrupted" && (
                <InterruptedBanner
                  onRetry={() => {
                    setRecovery("idle");
                    reload();
                  }}
                />
              )}
              {error && (
                <div className="my-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                  {error.message}
                </div>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)] to-transparent px-4 pb-4 pt-2">
            <div className="mx-auto w-full max-w-3xl">
              {composer}
              <p className="mt-2 text-center text-xs text-[var(--color-fg-muted)]">
                avGPT grounds every answer in live web search. It can still make mistakes — verify important info.
              </p>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
