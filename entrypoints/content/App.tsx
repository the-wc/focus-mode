import { useState, useEffect } from "react";
import { BlockedOverlay } from "./BlockedOverlay";

export default function App({
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
        onDismiss={onDismiss}
      />
    </div>
  );
}
