"use client";

import { Globe, Pencil, ImageIcon } from "lucide-react";

const CHIPS = [
  {
    icon: ImageIcon,
    label: "Create an image",
    prompt: "Find images of ",
  },
  {
    icon: Pencil,
    label: "Write or edit",
    prompt: "Help me write ",
  },
  {
    icon: Globe,
    label: "Look something up",
    prompt: "Look up ",
  },
];

export function EmptyStateChips({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
      {CHIPS.map(({ icon: Icon, label, prompt }) => (
        <button
          key={label}
          onClick={() => onPick(prompt)}
          className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-1.5 text-sm text-[var(--color-fg)] hover:bg-[var(--color-bg-elevated)]"
        >
          <Icon size={15} className="text-[var(--color-fg-muted)]" />
          {label}
        </button>
      ))}
    </div>
  );
}

export function EmptyHeading() {
  return (
    <h1 className="mb-6 text-center text-3xl font-normal text-[var(--color-fg)]">
      What&rsquo;s on your mind today?
    </h1>
  );
}
