"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import {
  DEFAULT_SETTINGS,
  SETTINGS_BOUNDS,
  type PreSearchMode,
  type SearchSettings,
} from "@/lib/settings";
import { cn } from "@/lib/cn";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: SearchSettings;
  onChange: (next: SearchSettings) => void;
};

const PRE_SEARCH_OPTIONS: { value: PreSearchMode; label: string; description: string }[] = [
  { value: "smart", label: "Smart", description: "Search only when the question needs fresh facts." },
  { value: "always", label: "Always", description: "Pre-search before every prompt." },
  { value: "never", label: "Never", description: "Skip pre-search; the model can still call web_search itself." },
];

export function SettingsDialog({ open, onOpenChange, settings, onChange }: Props) {
  const update = (patch: Partial<SearchSettings>) => onChange({ ...settings, ...patch });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6 text-[var(--color-fg)] shadow-2xl outline-none">
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="text-base font-semibold">Search settings</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-[var(--color-fg-muted)]">
                Control how avGPT grounds its answers.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                aria-label="Close"
                className="rounded-md p-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-fg)]"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-6 space-y-6">
            <Slider
              label="Max search rounds"
              value={settings.maxSteps}
              min={SETTINGS_BOUNDS.maxSteps.min}
              max={SETTINGS_BOUNDS.maxSteps.max}
              onChange={(v) => update({ maxSteps: v })}
              hint="How many times the model can call the web_search tool. Higher = more thorough, slower."
            />
            <Slider
              label="Results per search"
              value={settings.maxResults}
              min={SETTINGS_BOUNDS.maxResults.min}
              max={SETTINGS_BOUNDS.maxResults.max}
              onChange={(v) => update({ maxResults: v })}
              hint="Snippets returned by each query. Higher = better grounding, larger context."
            />
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm font-medium">Pre-search</span>
                <span className="text-xs capitalize text-[var(--color-fg-muted)]">
                  {settings.preSearchMode}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {PRE_SEARCH_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => update({ preSearchMode: opt.value })}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-sm transition",
                      settings.preSearchMode === opt.value
                        ? "border-[var(--color-fg)] bg-[var(--color-sidebar-hover)] text-[var(--color-fg)]"
                        : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-fg)]",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-[var(--color-fg-muted)]">
                {PRE_SEARCH_OPTIONS.find((o) => o.value === settings.preSearchMode)?.description}
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
            <button
              onClick={() => onChange({ ...DEFAULT_SETTINGS })}
              className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] underline-offset-2 hover:underline"
            >
              Reset to defaults
            </button>
            <Dialog.Close asChild>
              <button className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] hover:opacity-90">
                Done
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm tabular-nums text-[var(--color-fg-muted)]">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--color-fg)]"
      />
      {hint && <p className="mt-2 text-xs text-[var(--color-fg-muted)]">{hint}</p>}
    </div>
  );
}
