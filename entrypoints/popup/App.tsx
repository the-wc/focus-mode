import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  blockRulesStorage,
  blockEventsStorage,
  extractDomain,
  generateId,
  type BlockRule,
  type BlockEvent,
} from "@/lib/storage";
import { findMatchingRule } from "@/lib/matching";

function App() {
  const [rules, setRules] = useState<BlockRule[]>([]);
  const [events, setEvents] = useState<BlockEvent[]>([]);
  const [currentHost, setCurrentHost] = useState("");
  const [currentUrl, setCurrentUrl] = useState("");

  useEffect(() => {
    blockRulesStorage.getValue().then(setRules);
    blockEventsStorage.getValue().then(setEvents);
    const unwatchRules = blockRulesStorage.watch(setRules);
    const unwatchEvents = blockEventsStorage.watch(setEvents);

    browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.url) {
        try {
          const url = new URL(tab.url);
          const host = url.hostname.replace(/^www\./, "");
          setCurrentHost(host);
          setCurrentUrl(host + url.pathname);
        } catch {}
      }
    });

    return () => {
      unwatchRules();
      unwatchEvents();
    };
  }, []);

  const matchingRule = findMatchingRule(currentUrl, rules);

  async function addRule(pattern: string) {
    const clean = pattern.replace(/^www\./, "").trim().toLowerCase();
    if (!clean) return;
    const current = await blockRulesStorage.getValue();
    if (current.some((r) => r.pattern === clean)) return;
    await blockRulesStorage.setValue([
      ...current,
      {
        id: generateId(),
        pattern: clean,
        domain: extractDomain(clean),
        timerSeconds: 30,
        accessLimit: 0,
        limitPeriod: "day" as const,
        browseSeconds: 300,
        addedAt: Date.now(),
      },
    ]);
  }

  function openDashboard(domain?: string) {
    const url = browser.runtime.getURL("dashboard.html");
    browser.tabs.create({ url: domain ? `${url}#${domain}` : url });
  }

  function getStats(domain: string) {
    const domainRuleIds = new Set(
      rules.filter((r) => r.domain === domain).map((r) => r.id),
    );
    const now = Date.now();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const dayMs = startOfDay.getTime();
    const weekMs = now - 7 * 24 * 60 * 60 * 1000;
    const monthMs = now - 30 * 24 * 60 * 60 * 1000;

    const relevant = events.filter((e) => domainRuleIds.has(e.ruleId));
    return {
      today: relevant.filter((e) => e.timestamp >= dayMs).length,
      week: relevant.filter((e) => e.timestamp >= weekMs).length,
      month: relevant.filter((e) => e.timestamp >= monthMs).length,
    };
  }

  const stats = currentHost ? getStats(currentHost) : null;
  const hasAnyRuleForDomain = rules.some((r) => r.domain === currentHost);

  return (
    <div className="w-[320px] bg-background text-foreground p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold tracking-tight">Focus Mode</h1>
        <button
          onClick={() => openDashboard()}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Dashboard
        </button>
      </div>

      {/* Block current site */}
      {currentHost && !matchingRule && (
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={() => addRule(currentHost)}
        >
          Block {currentHost}
        </Button>
      )}

      {/* Blocked status */}
      {currentHost && matchingRule && (
        <div className="space-y-3">
          <div className="rounded-md border px-3 py-2">
            <span className="text-xs text-muted-foreground">
              {currentHost} is blocked
            </span>
          </div>
          <button
            onClick={() => openDashboard(currentHost)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Configure {currentHost} &rarr;
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
