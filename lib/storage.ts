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

/** Get the start-of-period timestamp for a limit period (calendar-based reset) */
export function periodStart(period: LimitPeriod): number {
  const now = new Date();
  switch (period) {
    case "day": {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return d.getTime();
    }
    case "week": {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      // Reset on Monday (getDay(): 0=Sun, 1=Mon, ...)
      const dayOfWeek = d.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // days since Monday
      d.setDate(d.getDate() - diff);
      return d.getTime();
    }
    case "2weeks": {
      // Use ISO week number, reset every even week on Monday
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dayOfWeek = d.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      d.setDate(d.getDate() - diff); // this Monday
      // Compute ISO week number
      const jan4 = new Date(d.getFullYear(), 0, 4);
      const startOfWeek1 = new Date(jan4);
      const jan4Day = jan4.getDay() || 7;
      startOfWeek1.setDate(jan4.getDate() - (jan4Day - 1));
      const weekNum = Math.ceil(((d.getTime() - startOfWeek1.getTime()) / 86400000 + 1) / 7);
      if (weekNum % 2 === 0) {
        // Even week — period started this Monday
        return d.getTime();
      } else {
        // Odd week — period started last Monday
        d.setDate(d.getDate() - 7);
        return d.getTime();
      }
    }
    case "month": {
      return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    }
    case "3months": {
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      return new Date(now.getFullYear(), quarterMonth, 1).getTime();
    }
    case "6months": {
      const halfMonth = now.getMonth() < 6 ? 0 : 6;
      return new Date(now.getFullYear(), halfMonth, 1).getTime();
    }
    case "year": {
      return new Date(now.getFullYear(), 0, 1).getTime();
    }
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

export interface ActiveSession {
  ruleId: string;
  expiresAt: number;
}

export const activeSessionsStorage = storage.defineItem<ActiveSession[]>(
  "local:activeSessions",
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
  return host.replace(/^www\./, "").toLowerCase();
}

/** Generate a short random id */
export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}
