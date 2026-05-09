"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { ModelInfo } from "./ChatApp";

export function ModelPicker({
  models,
  value,
  onChange,
}: {
  models: ModelInfo[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return models;
    return models.filter((m) => m.id.toLowerCase().includes(q));
  }, [models, query]);

  const display = value || "Select model";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-[var(--color-bg-elevated)]">
          <span className="max-w-[280px] truncate">{display}</span>
          <ChevronDown size={14} className="text-[var(--color-fg-muted)]" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="z-50 max-h-[60vh] w-[360px] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-1 shadow-xl"
        >
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-2 py-1.5">
            <Search size={14} className="text-[var(--color-fg-muted)]" />
            <input
              autoFocus
              placeholder="Search models…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <div className="scrollbar-thin max-h-[50vh] overflow-y-auto py-1">
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-[var(--color-fg-muted)]">
                No models match.
              </div>
            )}
            {filtered.map((m) => (
              <DropdownMenu.Item
                key={m.id}
                onSelect={() => onChange(m.id)}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-[var(--color-bg-elevated)]"
              >
                <div className="flex-1 truncate font-medium">{m.id}</div>
                {value === m.id && <Check size={14} />}
              </DropdownMenu.Item>
            ))}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
