import ReactDOM from "react-dom/client";
import { blockRulesStorage, blockEventsStorage, periodToMs, type BlockRule } from "@/lib/storage";
import { findMatchingRule } from "@/lib/matching";
import App from "./App";
import "./style.css";

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "ui",
  runAt: "document_start",
  async main(ctx) {
    const currentUrl = window.location.hostname.replace(/^www\./, "") + window.location.pathname;
    const currentHostname = window.location.hostname.replace(/^www\./, "");

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

    async function showOverlay(rule: BlockRule) {
      if (ui) return;

      await recordBlock(rule);
      await waitForBody();

      // Switch from full hide to just overflow hidden — overlay covers the rest
      hideStyle.textContent = "html { overflow: hidden !important; }";

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
              canRequestAccess={rule.accessLimit > 0}
              onDismiss={() => {
                hideStyle.remove();
                ui?.remove();
                ui = null;

                // If browse time is configured, re-block after it expires
                const browseSec = rule.browseSeconds ?? 0;
                if (browseSec > 0) {
                  setTimeout(() => {
                    showOverlay(rule);
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
      const rules = await blockRulesStorage.getValue();
      const rule = findMatchingRule(currentUrl, rules);
      if (!rule) return;

      if (rule.accessLimit > 0) {
        const exhausted = await hasExhaustedLimit(rule);
        if (!exhausted) return;
      }

      await showOverlay(rule);
    }

    await checkAndBlock();

    // If no overlay was shown, reveal the page
    if (!ui) {
      hideStyle.remove();
    }

    blockRulesStorage.watch(() => {
      if (!ui) checkAndBlock();
    });
  },
});
