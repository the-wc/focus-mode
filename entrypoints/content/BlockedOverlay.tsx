import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TimerPrompt } from "./TimerPrompt";

export function BlockedOverlay({
  hostname,
  timerSeconds,
  canRequestAccess,
  onDismiss,
}: {
  hostname: string;
  timerSeconds: number;
  canRequestAccess: boolean;
  onDismiss: () => void;
}) {
  const [phase, setPhase] = useState<"blocked" | "timer">("blocked");

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
            <Button variant="outline" size="sm" onClick={() => setPhase("timer")}>
              Request access
            </Button>
          )}
        </div>
      ) : (
        <TimerPrompt timerSeconds={timerSeconds} onComplete={onDismiss} />
      )}
    </div>
  );
}
