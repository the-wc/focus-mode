import ReactDOM from "react-dom/client";
import { blockRulesStorage, blockEventsStorage, activeSessionsStorage, periodToMs, type BlockRule } from "@/lib/storage";
import { findMatchingRule } from "@/lib/matching";
import App from "./App";
import "./style.css";

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "ui",
  runAt: "document_start",
  async main(ctx) {
    let currentUrl = window.location.hostname.replace(/^www\./, "") + window.location.pathname;
    let currentHostname = window.location.hostname.replace(/^www\./, "");

    function getCurrentUrl() {
      return window.location.hostname.replace(/^www\./, "") + window.location.pathname;
    }

    // Immediately hide page to prevent flash — works even before <head> exists
    const hideStyle = document.createElement("style");
    hideStyle.textContent = "html { visibility: hidden !important; }";
    document.documentElement.appendChild(hideStyle);

    let ui: Awaited<ReturnType<typeof createShadowRootUi>> | null = null;

    async function hasExhaustedLimit(rule: BlockRule): Promise<boolean> {
      if (rule.accessLimit === 0) return true;
      const events = await blockEventsStorage.getValue();
      const periodMs = periodToMs(rule.limitPeriod);
      const cutoff = Date.now() - periodMs;
      const count = events.filter(
        (e) => e.ruleId === rule.id && e.timestamp >= cutoff,
      ).length;
      return count >= rule.accessLimit;
    }

    async function recordBlock(rule: BlockRule) {
      const events = await blockEventsStorage.getValue();
      const cutoff = Date.now() - 366 * 24 * 60 * 60 * 1000;
      const pruned = events.filter((e) => e.timestamp >= cutoff);
      pruned.push({ ruleId: rule.id, timestamp: Date.now() });
      await blockEventsStorage.setValue(pruned);
    }

    // Wait for body to exist before creating shadow root UI
    function waitForBody(): Promise<void> {
      if (document.body) return Promise.resolve();
      return new Promise((resolve) => {
        const observer = new MutationObserver(() => {
          if (document.body) {
            observer.disconnect();
            resolve();
          }
        });
        observer.observe(document.documentElement, { childList: true });
      });
    }

    async function hasActiveSession(rule: BlockRule): Promise<boolean> {
      const sessions = await activeSessionsStorage.getValue();
      return sessions.some((s) => s.ruleId === rule.id && s.expiresAt > Date.now());
    }

    async function grantSession(rule: BlockRule) {
      const browseSec = rule.browseSeconds ?? 0;
      if (browseSec <= 0) return;
      const sessions = await activeSessionsStorage.getValue();
      // Prune expired sessions and add the new one
      const now = Date.now();
      const active = sessions.filter((s) => s.expiresAt > now);
      active.push({ ruleId: rule.id, expiresAt: now + browseSec * 1000 });
      await activeSessionsStorage.setValue(active);
    }

    async function revokeSession(rule: BlockRule) {
      const sessions = await activeSessionsStorage.getValue();
      await activeSessionsStorage.setValue(sessions.filter((s) => s.ruleId !== rule.id));
    }

    async function showOverlay(rule: BlockRule, mode: "gate" | "exhausted" | "blocked") {
      if (ui) return;

      await waitForBody();

      // Switch from full hide to just overflow hidden — overlay covers the rest
      hideStyle.textContent = "html { overflow: hidden !important; }";

      // Count sessions used in the current period
      let sessionsUsed = 0;
      if (rule.accessLimit > 0) {
        const events = await blockEventsStorage.getValue();
        const periodMs = periodToMs(rule.limitPeriod);
        const cutoff = Date.now() - periodMs;
        sessionsUsed = events.filter(
          (e) => e.ruleId === rule.id && e.timestamp >= cutoff,
        ).length;
      }

      ui = await createShadowRootUi(ctx, {
        name: "focus-mode-overlay",
        position: "overlay",
        zIndex: 2147483647,
        onMount(container) {
          const root = ReactDOM.createRoot(container);
          root.render(
            <App
              hostname={currentHostname}
              timerSeconds={rule.timerSeconds}
              canRequestAccess={mode === "gate"}
              sessionsExhausted={mode === "exhausted"}
              sessionsUsed={sessionsUsed}
              sessionsLimit={rule.accessLimit}
              onDismiss={async () => {
                if (mode === "gate") {
                  await recordBlock(rule);
                  await grantSession(rule);
                }

                hideStyle.remove();
                ui?.remove();
                ui = null;

                // If browse time is configured, re-block after it expires
                const browseSec = rule.browseSeconds ?? 0;
                if (browseSec > 0) {
                  setTimeout(async () => {
                    await revokeSession(rule);
                    showOverlay(rule, "blocked");
                  }, browseSec * 1000);
                }
              }}
            />,
          );
          return root;
        },
        onRemove(root) {
          root?.unmount();
        },
      });
      ui.mount();
    }

    async function checkAndBlock() {
      // Re-read URL in case of SPA navigation
      currentUrl = getCurrentUrl();
      currentHostname = window.location.hostname.replace(/^www\./, "");

      const rules = await blockRulesStorage.getValue();
      const rule = findMatchingRule(currentUrl, rules);
      if (!rule) return;

      // If there's an active session for this rule, allow through
      if (await hasActiveSession(rule)) return;

      // Re-attach hide style if it was removed (e.g. after SPA navigation from an allowed page)
      if (!hideStyle.parentNode) {
        hideStyle.textContent = "html { visibility: hidden !important; }";
        document.documentElement.appendChild(hideStyle);
      }

      if (rule.accessLimit > 0) {
        const exhausted = await hasExhaustedLimit(rule);
        if (!exhausted) {
          await showOverlay(rule, "gate");
          return;
        }
        await showOverlay(rule, "exhausted");
        return;
      }

      await showOverlay(rule, "blocked");
    }

    await checkAndBlock();

    // If no overlay was shown, reveal the page
    if (!ui) {
      hideStyle.remove();
    }

    blockRulesStorage.watch(() => {
      if (!ui) checkAndBlock();
    });

    // Detect SPA navigations (pushState/replaceState/popstate) and re-check blocking
    async function onUrlChange() {
      const newUrl = getCurrentUrl();
      if (newUrl === currentUrl) return;
      currentUrl = newUrl;
      currentHostname = window.location.hostname.replace(/^www\./, "");

      // If navigating to an allowed URL, remove the overlay
      const rules = await blockRulesStorage.getValue();
      const rule = findMatchingRule(currentUrl, rules);
      if (!rule && ui) {
        hideStyle.remove();
        ui.remove();
        ui = null;
        return;
      }

      if (rule) {
        // Remove existing overlay so checkAndBlock can show a fresh one for the new URL
        if (ui) {
          ui.remove();
          ui = null;
        }
        checkAndBlock();
      }
    }

    // Listen for URL change messages from the background script (handles SPA navigations)
    browser.runtime.onMessage.addListener((message) => {
      if (message?.type === "url-changed") {
        onUrlChange();
      }
    });

    // Also handle back/forward navigation
    window.addEventListener("popstate", onUrlChange);
  },
});
