"use client";

export function ThinkingDots() {
  return (
    <div className="my-4 flex gap-4">
      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-elevated)] text-[10px] font-semibold">
        av
      </div>
      <div className="flex items-center gap-1.5 pt-2">
        <span className="dot" />
        <span className="dot" style={{ animationDelay: "0.15s" }} />
        <span className="dot" style={{ animationDelay: "0.3s" }} />
      </div>
      <style>{`
        .dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--color-fg-muted);
          display: inline-block;
          animation: thinking 1.2s ease-in-out infinite;
        }
        @keyframes thinking {
          0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-2px); }
        }
      `}</style>
    </div>
  );
}
