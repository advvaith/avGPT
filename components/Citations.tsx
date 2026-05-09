"use client";

import { ExternalLink } from "lucide-react";

export function Citations({ items }: { items: { title: string; url: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-3">
      <span className="text-xs font-medium text-[var(--color-fg-muted)]">Sources</span>
      {items.map((c, i) => {
        let host = "";
        try {
          host = new URL(c.url).hostname.replace(/^www\./, "");
        } catch {
          host = c.url;
        }
        return (
          <a
            key={c.url}
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            title={c.title}
            className="flex max-w-[260px] items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2.5 py-1 text-xs text-[var(--color-fg)] hover:bg-[var(--color-sidebar-hover)]"
          >
            <span className="font-medium">[{i + 1}]</span>
            <span className="truncate">{host}</span>
            <ExternalLink size={10} className="shrink-0 text-[var(--color-fg-muted)]" />
          </a>
        );
      })}
    </div>
  );
}
