"use client";

import { ArrowUp, Plus, Square } from "lucide-react";
import { useEffect, useRef } from "react";

export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  isStreaming,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    const next = Math.min(ta.scrollHeight, 240);
    ta.style.height = `${next}px`;
  }, [value]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && value.trim()) onSubmit();
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!isStreaming && value.trim()) onSubmit(e);
      }}
      className="flex items-end gap-1 rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-2 shadow-sm focus-within:border-[var(--color-fg-muted)]"
    >
      <button
        type="button"
        aria-label="Attach"
        disabled
        title="Attachments coming soon"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--color-fg-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-fg)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Plus size={18} />
      </button>

      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={isStreaming ? "Generating reply…" : "Ask anything"}
        rows={1}
        disabled={disabled || isStreaming}
        readOnly={isStreaming}
        className="max-h-60 flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-6 outline-none placeholder:text-[var(--color-fg-muted)] disabled:cursor-not-allowed disabled:opacity-60"
      />

      {isStreaming ? (
        <button
          type="button"
          onClick={onStop}
          aria-label="Stop"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:opacity-90"
        >
          <Square size={14} fill="currentColor" />
        </button>
      ) : (
        <button
          type="submit"
          aria-label="Send"
          disabled={!value.trim() || disabled}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-accent-fg)] transition-opacity hover:opacity-90 disabled:bg-[var(--color-border)] disabled:text-[var(--color-fg-muted)]"
        >
          <ArrowUp size={18} />
        </button>
      )}
    </form>
  );
}
