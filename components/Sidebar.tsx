"use client";

import { useState } from "react";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Trash2,
  SquarePen,
  Search,
  LogOut,
  Settings as SettingsIcon,
} from "lucide-react";
import type { Conversation } from "./ChatApp";
import { cn } from "@/lib/cn";
import { ConfirmDialog } from "./ConfirmDialog";

type Props = {
  open: boolean;
  onToggle: () => void;
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
};

export function Sidebar({
  open,
  onToggle,
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
  onOpenSettings,
}: Props) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null);

  const filtered = query.trim()
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : conversations;

  if (!open) {
    return (
      <div className="flex h-full w-[52px] shrink-0 flex-col items-center gap-2 bg-[var(--color-sidebar)] py-3">
        <button
          aria-label="Open sidebar"
          onClick={onToggle}
          className="rounded-lg p-2 text-[var(--color-fg-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-fg)]"
        >
          <PanelLeftOpen size={18} />
        </button>
        <button
          aria-label="New chat"
          onClick={onNewChat}
          className="rounded-lg p-2 text-[var(--color-fg-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-fg)]"
        >
          <SquarePen size={18} />
        </button>
      </div>
    );
  }

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col bg-[var(--color-sidebar)] text-[var(--color-fg)]">
      <div className="flex items-center justify-between px-3 pt-3">
        <span className="px-2 text-[15px] font-semibold tracking-tight">avGPT</span>
        <button
          aria-label="Close sidebar"
          onClick={onToggle}
          className="rounded-lg p-2 text-[var(--color-fg-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-fg)]"
        >
          <PanelLeftClose size={18} />
        </button>
      </div>

      <nav className="mt-2 flex flex-col px-2">
        <NavItem
          icon={<SquarePen size={16} />}
          label="New chat"
          onClick={onNewChat}
          active={activeId === null}
        />
        <NavItem
          icon={<Search size={16} />}
          label="Search chats"
          onClick={() => setSearchOpen((v) => !v)}
          active={searchOpen}
        />
        {searchOpen && (
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find in chats…"
            className="mx-2 mt-1 rounded-md border border-[var(--color-border)] bg-[var(--color-sidebar-hover)] px-2.5 py-1.5 text-sm outline-none placeholder:text-[var(--color-fg-muted)] focus:border-[var(--color-fg-muted)]"
          />
        )}
      </nav>

      <div className="scrollbar-thin mt-4 flex-1 overflow-y-auto px-2">
        <div className="px-3 pb-1 pt-2 text-xs font-medium text-[var(--color-fg-muted)]">
          Recents
        </div>
        {filtered.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-[var(--color-fg-muted)]">
            {query ? "No matches" : "No chats yet"}
          </div>
        )}
        {filtered.map((c) => (
          <ConversationRow
            key={c.id}
            conv={c}
            active={c.id === activeId}
            onSelect={() => onSelect(c.id)}
            onDelete={() => setPendingDelete(c)}
          />
        ))}
      </div>

      <UserPill onOpenSettings={onOpenSettings} />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete chat?"
        description={
          pendingDelete
            ? `"${pendingDelete.title || "New chat"}" will be removed permanently.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (pendingDelete) onDelete(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </aside>
  );
}

function NavItem({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm",
        active
          ? "bg-[var(--color-sidebar-hover)] text-[var(--color-fg)]"
          : "text-[var(--color-fg)] hover:bg-[var(--color-sidebar-hover)]",
      )}
    >
      <span className="text-[var(--color-fg-muted)]">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
    </button>
  );
}

function ConversationRow({
  conv,
  active,
  onSelect,
  onDelete,
}: {
  conv: Conversation;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm",
        active
          ? "bg-[var(--color-sidebar-hover)] text-[var(--color-fg)]"
          : "text-[var(--color-fg)] hover:bg-[var(--color-sidebar-hover)]",
      )}
      onClick={onSelect}
    >
      <span className="flex-1 truncate">{conv.title || "New chat"}</span>
      <button
        aria-label="Delete chat"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="invisible rounded p-1 text-[var(--color-fg-muted)] hover:bg-[var(--color-bg)] hover:text-red-500 group-hover:visible"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function UserPill({ onOpenSettings }: { onOpenSettings: () => void }) {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  return (
    <div className="m-2 flex items-center gap-1 rounded-xl px-2 py-2 hover:bg-[var(--color-sidebar-hover)]">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-semibold text-black">
        U
      </div>
      <div className="ml-2 min-w-0 flex-1">
        <div className="truncate text-sm font-medium">User</div>
        <div className="truncate text-xs text-[var(--color-fg-muted)]">Self-hosted</div>
      </div>
      <button
        onClick={onOpenSettings}
        aria-label="Settings"
        className="rounded-md p-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-fg)]"
      >
        <SettingsIcon size={14} />
      </button>
      <button
        onClick={logout}
        aria-label="Sign out"
        className="rounded-md p-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-fg)]"
      >
        <LogOut size={14} />
      </button>
    </div>
  );
}
