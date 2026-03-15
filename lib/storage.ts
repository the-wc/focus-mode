import { storage } from "#imports";

export type TimerUnit = "s" | "m" | "h";
export type LimitPeriod = "day" | "week" | "2weeks" | "month" | "3months" | "6months" | "year";

export const TIMER_UNITS: { value: TimerUnit; label: string }[] = [
  { value: "s", label: "s" },
  { value: "m", label: "min" },
  { value: "h", label: "hr" },
];

export const LIMIT_PERIODS: { value: LimitPeriod; label: string }[] = [
  { value: "day", label: "/day" },
  { value: "week", label: "/week" },
  { value: "2weeks", label: "/2 wk" },
  { value: "month", label: "/mo" },
  { value: "3months", label: "/3 mo" },
  { value: "6months", label: "/6 mo" },
  { value: "year", label: "/yr" },
];

/** Convert timer value + unit to seconds */
export function timerToSeconds(value: number, unit: TimerUnit): number {
  if (unit === "m") return value * 60;
  if (unit === "h") return value * 3600;
  return value;
}

/** Convert seconds to best display value + unit */
export function secondsToTimer(seconds: number): { value: number; unit: TimerUnit } {
  if (seconds >= 3600 && seconds % 3600 === 0) return { value: seconds / 3600, unit: "h" };
  if (seconds >= 60 && seconds % 60 === 0) return { value: seconds / 60, unit: "m" };
  return { value: seconds, unit: "s" };
}

/** Get the duration in ms for a limit period */
export function periodToMs(period: LimitPeriod): number {
  const day = 24 * 60 * 60 * 1000;
  switch (period) {
    case "day": return day;
    case "week": return 7 * day;
    case "2weeks": return 14 * day;
    case "month": return 30 * day;
    case "3months": return 90 * day;
    case "6months": return 180 * day;
    case "year": return 365 * day;
  }
}

export interface BlockRule {
  /** Unique id */
  id: string;
  /** Pattern like "reddit.com", "*.reddit.com", "reddit.com/r/funny/*" */
  pattern: string;
  /** Root domain for grouping, e.g. "reddit.com" */
  domain: string;
  /** Timer wait time in seconds before the user can proceed */
  timerSeconds: number;
  /** Max accesses allowed per period. 0 = always block */
  accessLimit: number;
  /** Period for the access limit */
  limitPeriod: LimitPeriod;
  addedAt: number;
  /** Where this rule came from, e.g. "Social Media" preset */
  source?: string;
  /** If true, this pattern is allowed even if other rules block it */
  isException?: boolean;
  /** How long (in seconds) the user can browse after passing the challenge. 0 = unlimited */
  browseSeconds?: number;
}

export interface BlockEvent {
  ruleId: string;
  timestamp: number;
}

export interface PromptEntry {
  id: string;
  text: string;
  /** Where this came from — "Default", a preset name, or undefined for user-created */
  source?: string;
}

export interface PromptConfig {
  prompts: PromptEntry[];
  includeDefaults: boolean;
  /** Indices of default prompts that have been excluded */
  excludedDefaults?: number[];
}

export const blockRulesStorage = storage.defineItem<BlockRule[]>(
  "local:blockRules",
  { fallback: [] },
);

export const blockEventsStorage = storage.defineItem<BlockEvent[]>(
  "local:blockEvents",
  { fallback: [] },
);

export const promptConfigStorage = storage.defineItem<PromptConfig>(
  "local:promptConfig",
  { fallback: { prompts: [], includeDefaults: true } },
);

/** Extract the root domain from a pattern for grouping */
export function extractDomain(pattern: string): string {
  let p = pattern.replace(/^https?:\/\//, "");
  p = p.replace(/^\*\./, "");
  const host = p.split("/")[0];
  return host.toLowerCase();
}

/** Generate a short random id */
export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}
