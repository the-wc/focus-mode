import { useState, useEffect } from "react";
import { BlockedOverlay } from "./BlockedOverlay";

export default function App({
  hostname,
  timerSeconds,
  canRequestAccess,
  sessionsExhausted,
  sessionsUsed,
  sessionsLimit,
  onDismiss,
}: {
  hostname: string;
  timerSeconds: number;
  canRequestAccess: boolean;
  sessionsExhausted: boolean;
  sessionsUsed: number;
  sessionsLimit: number;
  onDismiss: () => void;
}) {
  const [isDark, setIsDark] = useState(
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div
      className={isDark ? "dark" : ""}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 2147483647,
      }}
    >
      <BlockedOverlay
        hostname={hostname}
        timerSeconds={timerSeconds}
        canRequestAccess={canRequestAccess}
        sessionsExhausted={sessionsExhausted}
        sessionsUsed={sessionsUsed}
        sessionsLimit={sessionsLimit}
        onDismiss={onDismiss}
      />
    </div>
  );
}
