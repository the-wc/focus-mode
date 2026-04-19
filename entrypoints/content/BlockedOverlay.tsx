import { useState } from "react";
import { Button } from "@/components/ui/button";
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
    <div className="h-full w-full flex items-center justify-center bg-background text-foreground font-sans">
      {phase === "blocked" ? (
        <div className="flex flex-col items-center gap-6">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="m4.9 4.9 14.2 14.2" />
            </svg>
          </div>
          <div className="text-center space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight">
              Site blocked
            </h1>
            <p className="text-sm text-muted-foreground">
              You blocked{" "}
              <span className="font-medium text-foreground">{hostname}</span> to
              stay focused.
            </p>
          </div>
          {canRequestAccess && (
            <div className="flex flex-col items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRequestAccess}>
                Request access
              </Button>
              <button
                onClick={handlePauseForDay}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Pause for day
              </button>
            </div>
          )}
          {sessionsExhausted && (
            <p className="text-xs text-muted-foreground">
              You've already used all your sessions for this site.
            </p>
          )}
          {sessionsLimit > 0 && (
            <p className="text-xs text-muted-foreground">
              Sessions used: {sessionsUsed} / {sessionsLimit}
            </p>
          )}
        </div>
      ) : phase === "pick-duration" ? (
        <div className="flex flex-col items-center gap-6 w-full max-w-xs">
          <div className="text-center space-y-1.5">
            <h1 className="text-lg font-semibold tracking-tight">
              How long do you need?
            </h1>
            <p className="text-sm text-muted-foreground">
              Choose a session duration for{" "}
              <span className="font-medium text-foreground">{hostname}</span>
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full">
            {browseDurationOptions!.map((seconds) => (
              <Button
                key={seconds}
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => handlePickDuration(seconds)}
              >
                {formatDuration(seconds)}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handlePauseForDay}
            >
              Pause for day
            </Button>
          </div>
          <button
            onClick={() => setPhase("blocked")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Back
          </button>
        </div>
      ) : (
        <TimerPrompt timerSeconds={timerSeconds} onComplete={() => onDismiss(chosenDuration)} />
      )}
    </div>
  );
}
