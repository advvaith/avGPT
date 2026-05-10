"use client";

import { useEffect, useState, useCallback } from "react";
import { Sidebar } from "./Sidebar";
import { ChatPane } from "./ChatPane";
import { SettingsDialog } from "./SettingsDialog";
import { clampSettings, DEFAULT_SETTINGS, type SearchSettings } from "@/lib/settings";

export type Conversation = {
  id: string;
  title: string;
  model: string;
  createdAt: number;
  updatedAt: number;
};

export type ModelInfo = {
  id: string;
  description?: string;
  owned_by?: string;
};

const DEFAULT_MODEL_FALLBACKS = [
  "deepseek/deepseek-v4-pro-cheaper:thinking",
  "deepseek-v4-pro-cheaper:thinking",
  "deepseek/deepseek-v4-pro-cheaper",
  "openai/gpt-4o",
  "gpt-4o",
  "anthropic/claude-sonnet-4-5",
  "claude-sonnet-4-5",
];

export function ChatApp() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [paneKey, setPaneKey] = useState<string>("new-1");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [model, setModel] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settings, setSettings] = useState<SearchSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("avgpt:settings");
    if (raw) {
      try {
        setSettings(clampSettings(JSON.parse(raw)));
      } catch {
        /* ignore invalid stored value */
      }
    }
  }, []);

  const updateSettings = useCallback((next: SearchSettings) => {
    const safe = clampSettings(next);
    setSettings(safe);
    localStorage.setItem("avgpt:settings", JSON.stringify(safe));
  }, []);

  const refreshConversations = useCallback(async () => {
    const res = await fetch("/api/conversations");
    if (!res.ok) return;
    const data = (await res.json()) as { conversations: Conversation[] };
    setConversations(data.conversations);
  }, []);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/models");
      if (!res.ok) return;
      const data = (await res.json()) as { models: ModelInfo[] };
      setModels(data.models);
      const stored = localStorage.getItem("avgpt:model");
      if (stored && data.models.some((m) => m.id === stored)) {
        setModel(stored);
      } else {
        const fallback = DEFAULT_MODEL_FALLBACKS.find((id) =>
          data.models.some((m) => m.id === id),
        );
        setModel(fallback ?? data.models[0]?.id ?? "");
      }
    })();
  }, []);

  useEffect(() => {
    if (model) localStorage.setItem("avgpt:model", model);
  }, [model]);

  const newChat = useCallback(() => {
    setActiveId(null);
    setPaneKey(`new-${Date.now()}`);
  }, []);

  const selectConv = useCallback((id: string) => {
    setActiveId(id);
    setPaneKey(id);
  }, []);

  const deleteConv = useCallback(
    async (id: string) => {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (activeId === id) {
        setActiveId(null);
        setPaneKey(`new-${Date.now()}`);
      }
      refreshConversations();
    },
    [activeId, refreshConversations],
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--color-bg)] text-[var(--color-fg)]">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        conversations={conversations}
        activeId={activeId}
        onSelect={selectConv}
        onNewChat={newChat}
        onDelete={deleteConv}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <ChatPane
        key={paneKey}
        conversationId={activeId}
        models={models}
        model={model}
        onModelChange={setModel}
        onConversationCreated={async (id) => {
          setActiveId(id);
          await refreshConversations();
        }}
        onTurnFinished={refreshConversations}
        onSidebarToggle={() => setSidebarOpen((v) => !v)}
        sidebarOpen={sidebarOpen}
        settings={settings}
      />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onChange={updateSettings}
      />
    </div>
  );
}
