import { useState, useEffect } from "react";
import { getRandomPrompt, checkResponse } from "@/lib/prompts";

function formatTime(secondsLeft: number, totalSeconds: number): string {
  if (totalSeconds < 60) {
    return String(secondsLeft);
  }
  if (totalSeconds < 3600) {
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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
  const check = checkResponse(response);
  const canProceed = secondsLeft === 0 && check.ok;
  const display = formatTime(secondsLeft, timerSeconds);

  return (
    <section className="w-full max-w-sm overflow-hidden rounded-[6px] border border-[var(--ov-rule)]">
      <div className="flex flex-col gap-6 p-7">
        {/* Countdown readout */}
        <div className="space-y-3">
          <p className="ov-mono text-[0.6875em] tracking-[0.18em] uppercase text-[var(--ov-dim)]">
            {secondsLeft > 0 ? "Unlock in" : "Unlocked"}
          </p>
          <div className="ov-mono text-4xl font-medium tabular-nums tracking-tight leading-none">
            {display}
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--ov-rule)]">
            <div
              className="h-full rounded-full bg-[var(--ov-signal)] transition-all duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Reflection */}
        <div className="space-y-2">
          <p className="ov-mono text-[0.6875em] tracking-[0.18em] uppercase text-[var(--ov-dim)]">
            Reflection
          </p>
          <p className="text-[0.8125em] leading-relaxed">{prompt || "…"}</p>
          <textarea
            placeholder="Type your response…"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            className="ov-field min-h-[88px]"
          />
        </div>

        <button className="ov-btn ov-btn-primary" disabled={!canProceed} onClick={onComplete}>
          {secondsLeft > 0
            ? `Wait ${display}`
            : check.ok
              ? "Continue to site"
              : check.reason}
        </button>
      </div>
    </section>
  );
}
