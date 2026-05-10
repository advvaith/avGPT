export type PreSearchMode = "smart" | "always" | "never";

export type SearchSettings = {
  maxSteps: number;
  maxResults: number;
  preSearchMode: PreSearchMode;
};

export const DEFAULT_SETTINGS: SearchSettings = {
  maxSteps: 3,
  maxResults: 6,
  preSearchMode: "smart",
};

export const SETTINGS_BOUNDS = {
  maxSteps: { min: 1, max: 6 },
  maxResults: { min: 3, max: 12 },
};

function clampNumber(
  value: unknown,
  fallback: number,
  bounds: { min: number; max: number },
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(bounds.min, Math.min(bounds.max, Math.round(value)));
}

export function clampSettings(input: unknown): SearchSettings {
  if (!input || typeof input !== "object") return { ...DEFAULT_SETTINGS };
  const i = input as Partial<SearchSettings>;
  return {
    maxSteps: clampNumber(i.maxSteps, DEFAULT_SETTINGS.maxSteps, SETTINGS_BOUNDS.maxSteps),
    maxResults: clampNumber(i.maxResults, DEFAULT_SETTINGS.maxResults, SETTINGS_BOUNDS.maxResults),
    preSearchMode:
      i.preSearchMode === "always" || i.preSearchMode === "never" || i.preSearchMode === "smart"
        ? i.preSearchMode
        : DEFAULT_SETTINGS.preSearchMode,
  };
}
