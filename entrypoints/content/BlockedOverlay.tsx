import { useState } from "react";
import { TimerPrompt } from "./TimerPrompt";
import { secondsToTimer, type TimerUnit } from "@/lib/storage";

function formatDuration(seconds: number): string {
  const { value, unit } = secondsToTimer(seconds);
  const labels: Record<TimerUnit, string> = { s: "sec", m: "min", h: "hr" };
  return `${value} ${labels[unit]}`;
}

function secondsUntilNextDay(): number {
  const now = new Date();
  const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(1, Math.floor((nextDay.getTime() - now.getTime()) / 1000));
}

// Shared retro-panel classes (see .ov-* in style.css).
const panel =
  "w-full max-w-sm overflow-hidden rounded-[6px] border border-[var(--ov-rule)]";
const statusStrip =
  "flex items-center px-3.5 py-2.5 border-b border-[var(--ov-rule)]";
const eyebrow = "ov-mono text-[0.6875em] tracking-[0.18em] uppercase text-[var(--ov-dim)]";

// Remaining sessions as filled pips, spent ones hollow (GBC-style charge markers).
function SessionPips({ used, limit }: { used: number; limit: number }) {
  const label = `${limit - used} of ${limit} sessions left today`;
  return (
    <div
      className="flex items-center gap-1"
      role="img"
      aria-label={label}
      title={label}
    >
      {Array.from({ length: limit }, (_, i) => (
        <span
          key={i}
          className={
            i < limit - used
              ? "h-1.5 w-1.5 rounded-full bg-[var(--ov-signal)]"
              : "h-1.5 w-1.5 rounded-full border border-[var(--ov-dim)]"
          }
        />
      ))}
    </div>
  );
}

export function BlockedOverlay({
  hostname,
  timerSeconds,
  canRequestAccess,
  sessionsExhausted,
  sessionsUsed,
  sessionsLimit,
  browseDurationOptions,
  onDismiss,
}: {
  hostname: string;
  timerSeconds: number;
  canRequestAccess: boolean;
  sessionsExhausted: boolean;
  sessionsUsed: number;
  sessionsLimit: number;
  browseDurationOptions?: number[];
  onDismiss: (chosenBrowseSeconds?: number) => void;
}) {
  const [phase, setPhase] = useState<"blocked" | "pick-duration" | "timer">("blocked");
  const [chosenDuration, setChosenDuration] = useState<number | undefined>();

  const hasDurationOptions = browseDurationOptions && browseDurationOptions.length > 0;

  function handleRequestAccess() {
    if (hasDurationOptions) {
      setPhase("pick-duration");
    } else {
      setPhase("timer");
    }
  }

  function handlePickDuration(seconds: number) {
    setChosenDuration(seconds);
    setPhase("timer");
  }

  function handlePauseForDay() {
    setChosenDuration(secondsUntilNextDay());
    setPhase("timer");
  }

  return (
    <div className="ov h-full w-full flex items-center justify-center bg-[var(--ov-ground)] text-[var(--ov-ink)] p-6">
      {phase === "blocked" ? (
        <section className={panel}>
          {sessionsLimit > 0 && (
            <header className={statusStrip}>
              <SessionPips used={sessionsUsed} limit={sessionsLimit} />
            </header>
          )}
          <div className="flex flex-col gap-6 p-7">
            <div className="space-y-2">
              <p className={eyebrow}>Blocked site</p>
              <h1 className="text-2xl font-medium tracking-tight leading-tight break-all">
                {hostname}
              </h1>
              <p className="text-[0.8125em] leading-relaxed text-[var(--ov-dim)]">
                Locked while you stay focused.
              </p>
            </div>

            {sessionsExhausted && (
              <p className="text-[0.8125em] text-[var(--ov-dim)]">
                No sessions left for this site today.
              </p>
            )}

            {canRequestAccess && (
              <button className="ov-btn ov-btn-primary" onClick={handleRequestAccess}>
                Request access
              </button>
            )}
          </div>
        </section>
      ) : phase === "pick-duration" ? (
        <section className={panel}>
          {sessionsLimit > 0 && (
            <header className={statusStrip}>
              <SessionPips used={sessionsUsed} limit={sessionsLimit} />
            </header>
          )}
          <div className="flex flex-col gap-6 p-7">
            <div className="space-y-2">
              <p className={eyebrow}>Session request</p>
              <h1 className="text-xl font-medium tracking-tight">How long do you need?</h1>
              <p className="text-[0.8125em] text-[var(--ov-dim)] break-all">For {hostname}</p>
            </div>

            <div className="flex flex-col gap-2">
              {browseDurationOptions!.map((seconds) => (
                <button
                  key={seconds}
                  className="ov-btn"
                  onClick={() => handlePickDuration(seconds)}
                >
                  {formatDuration(seconds)}
                </button>
              ))}
              <button className="ov-btn" onClick={handlePauseForDay}>
                Pause for day
              </button>
            </div>

            <button
              onClick={() => setPhase("blocked")}
              className="self-start text-[0.75em] tracking-[0.12em] uppercase text-[var(--ov-dim)] hover:text-[var(--ov-ink)] transition-colors"
            >
              ‹ Back
            </button>
          </div>
        </section>
      ) : (
        <TimerPrompt timerSeconds={timerSeconds} onComplete={() => onDismiss(chosenDuration)} />
      )}
    </div>
  );
}
