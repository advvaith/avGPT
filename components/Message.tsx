"use client";

import { Copy, RotateCcw, Search, Check } from "lucide-react";
import { useState } from "react";
import { Markdown } from "./Markdown";
import { Citations } from "./Citations";
import { cn } from "@/lib/cn";

type ToolInvocation = {
  toolName: string;
  args: unknown;
  state?: string;
  result?: unknown;
};

type Props = {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  onRegenerate?: () => void;
  toolInvocations?: ToolInvocation[];
  initialCitations?: { title: string; url: string }[];
};

export function Message({
  role,
  content,
  streaming,
  onRegenerate,
  toolInvocations,
  initialCitations,
}: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (role === "user") {
    return (
      <div className="my-4 flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-3xl bg-[var(--color-bubble-user)] px-4 py-2.5 text-[15px] leading-7">
          {content}
        </div>
      </div>
    );
  }

  const inFlightSearches = (toolInvocations ?? []).filter(
    (t) => t.toolName === "web_search",
  );

  const liveCitations: { title: string; url: string }[] = [];
  for (const t of inFlightSearches) {
    const r = t.result as
      | { results?: { title: string; url: string }[] }
      | undefined;
    for (const item of r?.results ?? []) {
      if (!liveCitations.some((c) => c.url === item.url)) {
        liveCitations.push({ title: item.title, url: item.url });
      }
    }
  }
  const citations = liveCitations.length ? liveCitations : initialCitations ?? [];

  return (
    <div className="group my-4">
      <div className="flex gap-4">
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-elevated)] text-[10px] font-semibold">
          av
        </div>
        <div className="min-w-0 flex-1">
          {inFlightSearches.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {inFlightSearches.map((t, i) => {
                const args = t.args as { query?: string } | undefined;
                const done = t.state === "result";
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg bg-[var(--color-bg-elevated)] px-3 py-1.5 text-xs text-[var(--color-fg-muted)]"
                  >
                    <Search size={12} />
                    <span className="truncate">
                      {done ? "Searched" : "Searching"} the web for{" "}
                      <span className="text-[var(--color-fg)]">"{args?.query}"</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className={cn("prose-chat", streaming && "cursor-blink")}>
            <Markdown>{content}</Markdown>
          </div>

          {citations.length > 0 && <Citations items={citations} />}

          {!streaming && (
            <div className="mt-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                aria-label="Copy"
                onClick={copy}
                className="rounded-md p-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-fg)]"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
              {onRegenerate && (
                <button
                  aria-label="Regenerate"
                  onClick={onRegenerate}
                  className="rounded-md p-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-fg)]"
                >
                  <RotateCcw size={14} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
