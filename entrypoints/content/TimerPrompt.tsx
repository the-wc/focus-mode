import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getRandomPrompt } from "@/lib/prompts";

function formatTime(
  secondsLeft: number,
  totalSeconds: number,
): { display: string; suffix?: string } {
  if (totalSeconds < 60) {
    return { display: String(secondsLeft) };
  }
  if (totalSeconds < 3600) {
    // MM:SS
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    return { display: `${m}:${String(s).padStart(2, "0")}` };
  }
  // HH:MM:SS
  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;
  return {
    display: `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
  };
}

export function TimerPrompt({
  timerSeconds,
  onComplete,
}: {
  timerSeconds: number;
  onComplete: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(timerSeconds);
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");

  useEffect(() => {
    getRandomPrompt().then(setPrompt);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const progress = ((timerSeconds - secondsLeft) / timerSeconds) * 100;
  const canProceed = secondsLeft === 0 && response.trim().length > 0;
  const time = formatTime(secondsLeft, timerSeconds);

  // Scale the ring size based on format
  const isLong = timerSeconds >= 3600;
  const ringSize = isLong ? 100 : timerSeconds >= 60 ? 88 : 80;
  const radius = ringSize * 0.45;

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-sm">
      {/* Circular timer */}
      <div className="relative" style={{ width: ringSize, height: ringSize }}>
        <svg
          className="-rotate-90"
          style={{ width: ringSize, height: ringSize }}
          viewBox={`0 0 ${ringSize} ${ringSize}`}
        >
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-muted"
          />
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray={2 * Math.PI * radius}
            strokeDashoffset={2 * Math.PI * radius * (1 - progress / 100)}
            strokeLinecap="round"
            className="text-foreground transition-all duration-1000 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-medium tabular-nums" style={{ fontSize: isLong ? 14 : timerSeconds >= 60 ? 16 : 18 }}>
            {time.display}
          </span>
          {time.suffix && (
            <span className="text-xs text-muted-foreground ml-0.5">
              {time.suffix}
            </span>
          )}
        </div>
      </div>

      {/* Prompt */}
      <div className="w-full space-y-3 text-center">
        <p className="text-sm text-muted-foreground">
          {prompt || "Loading..."}
        </p>
        <Textarea
          placeholder="Type your response..."
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          className="resize-none min-h-[80px] text-sm text-left"
        />
      </div>

      {/* Proceed */}
      <Button size="sm" disabled={!canProceed} onClick={onComplete}>
        {secondsLeft > 0
          ? `Wait ${time.display}${time.suffix ?? ""}`
          : response.trim().length === 0
            ? "Answer to continue"
            : "Continue to site"}
      </Button>
    </div>
  );
}
