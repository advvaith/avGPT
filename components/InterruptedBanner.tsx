"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export function InterruptedBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="my-4 flex items-start gap-3 rounded-xl border border-amber-300/30 bg-amber-500/10 p-3 text-sm text-amber-200">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <div className="flex-1">
        <div className="font-medium">Generation was interrupted</div>
        <div className="text-amber-200/80">
          The previous response didn&rsquo;t land — the page may have been refreshed mid-stream.
        </div>
      </div>
      <button
        onClick={onRetry}
        className="flex items-center gap-1.5 rounded-lg border border-amber-300/40 px-2.5 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-500/20"
      >
        <RotateCcw size={13} />
        Retry
      </button>
    </div>
  );
}
