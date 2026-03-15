import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Download,
  Upload,
  Shield,
  BookOpen,
  ChevronDown,
  X,
  Trash2,
  EllipsisVertical,
  Check,
  Search,
} from "lucide-react";
import {
  blockRulesStorage,
  blockEventsStorage,
  promptConfigStorage,
  extractDomain,
  generateId,
  secondsToTimer,
  timerToSeconds,
  TIMER_UNITS,
  LIMIT_PERIODS,
  type BlockRule,
  type BlockEvent,
  type PromptConfig,
  type PromptEntry,
  type TimerUnit,
  type LimitPeriod,
} from "@/lib/storage";
import { defaultPrompts } from "@/lib/prompts";
import { sitePresets, promptPresets, type BlockPreset, type PromptPreset } from "@/lib/presets";

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function App() {
  const [rules, setRules] = useState<BlockRule[]>([]);
  const [events, setEvents] = useState<BlockEvent[]>([]);
  const [promptConfig, setPromptConfig] = useState<PromptConfig>({
    customPrompts: [],
    includeDefaults: true,
  });
  const [input, setInput] = useState("");
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(
    new Set(),
  );
  const [tab, setTab] = useState<"sites" | "prompts">("sites");
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    blockRulesStorage.getValue().then(setRules);
    blockEventsStorage.getValue().then(setEvents);
    promptConfigStorage.getValue().then(setPromptConfig);
    const unwatchRules = blockRulesStorage.watch(setRules);
    const unwatchEvents = blockEventsStorage.watch(setEvents);
    const unwatchPrompts = promptConfigStorage.watch(setPromptConfig);

    const hash = window.location.hash.slice(1);
    if (hash) setExpandedDomains(new Set([hash]));

    return () => {
      unwatchRules();
      unwatchEvents();
      unwatchPrompts();
    };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, BlockRule[]>();
    for (const rule of rules) {
      const group = map.get(rule.domain) || [];
      group.push(rule);
      map.set(rule.domain, group);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rules]);

  function toggleDomain(domain: string) {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  async function addRule(pattern: string, source?: string) {
    const clean = pattern.replace(/^www\./, "").trim().toLowerCase();
    if (!clean) return;
    const current = await blockRulesStorage.getValue();
    if (current.some((r) => r.pattern === clean)) return;
    const domain = extractDomain(clean);
    await blockRulesStorage.setValue([
      ...current,
      {
        id: generateId(),
        pattern: clean,
        domain,
        timerSeconds: 30,
        accessLimit: 0,
        limitPeriod: "day" as const,
        browseSeconds: 300,
        addedAt: Date.now(),
        ...(source ? { source } : {}),
      },
    ]);
    setInput("");
    if (!source) {
      setExpandedDomains((prev) => new Set(prev).add(domain));
    }
  }

  async function removeRule(id: string) {
    const current = await blockRulesStorage.getValue();
    await blockRulesStorage.setValue(current.filter((r) => r.id !== id));
  }

  async function updateRule(id: string, updates: Partial<BlockRule>) {
    const current = await blockRulesStorage.getValue();
    await blockRulesStorage.setValue(
      current.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    );
  }

  async function removeAllForDomain(domain: string) {
    const current = await blockRulesStorage.getValue();
    await blockRulesStorage.setValue(
      current.filter((r) => r.domain !== domain),
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="max-w-3xl mx-auto px-4 py-16 space-y-8">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Focus Mode</h1>
          <p className="text-sm text-muted-foreground">
            Manage blocked sites and reflection prompts
          </p>
        </div>

        <div className="pt-8">
          <BlockHeatmap events={events} />
        </div>

        <div className="pt-4" />

        {/* Tabs */}
        <div className="flex items-center border-b">
          <div className="flex gap-4 flex-1">
            <button
              onClick={() => { setTab("sites"); setShowImport(false); }}
              className={`pb-2 text-sm transition-colors flex items-center gap-1.5 ${
                tab === "sites"
                  ? "border-b-2 border-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Shield size={14} />
              Blocked Sites
            </button>
            <button
              onClick={() => { setTab("prompts"); setShowImport(false); }}
              className={`pb-2 text-sm transition-colors flex items-center gap-1.5 ${
                tab === "prompts"
                  ? "border-b-2 border-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BookOpen size={14} />
              Prompts
            </button>
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => setShowImport(!showImport)}
            >
              {showImport ? <X size={14} /> : <Download size={14} />}
              {showImport ? "Close" : "Import"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={async () => {
                if (tab === "sites") {
                  const currentRules = await blockRulesStorage.getValue();
                  const config = {
                    name: "My Focus Mode Config",
                    description: "Exported block rules",
                    rules: currentRules.map((r) => ({
                      pattern: r.pattern,
                      timerSeconds: r.timerSeconds,
                      accessLimit: r.accessLimit,
                      limitPeriod: r.limitPeriod,
                      browseSeconds: r.browseSeconds ?? 0,
                    })),
                  };
                  downloadJson(config, "focus-mode-config.json");
                } else {
                  const current = await promptConfigStorage.getValue();
                  const prompts = Array.isArray(current.prompts) ? current.prompts : [];
                  downloadJson(
                    { name: "Focus Mode Prompts", prompts: prompts.map((p) => p.text) },
                    "focus-mode-prompts.json",
                  );
                }
              }}
            >
              <Upload size={14} />
              Export
            </Button>
          </div>
        </div>

        {tab === "sites" && (
          <SitesTab
            grouped={grouped}
            expandedDomains={expandedDomains}
            toggleDomain={toggleDomain}
            addRule={addRule}
            removeRule={removeRule}
            updateRule={updateRule}
            removeAllForDomain={removeAllForDomain}
            input={input}
            setInput={setInput}
            showImport={showImport}
          />
        )}

        {tab === "prompts" && (
          <PromptsTab config={promptConfig} showImport={showImport} />
        )}
      </div>
    </div>
  );
}

// ── Heatmap ──────────────────────────────────────────────────────────────────

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const HEAT_COLORS: [string, string][] = [
  ["#ebeef2", "#1c2028"],
  ["#c8d1dc", "#2a3444"],
  ["#94a3b8", "#3d4f66"],
  ["#6482a3", "#527199"],
  ["#3b6b9a", "#6b9fd4"],
];

function getHeatLevel(count: number): number {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

function BlockHeatmap({ events }: { events: BlockEvent[] }) {
  const [isDark, setIsDark] = useState(
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const { weeks, monthLabels, totalBlocks } = useMemo(() => {
    const countMap = new Map<string, number>();
    for (const event of events) {
      const d = new Date(event.timestamp);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      countMap.set(key, (countMap.get(key) || 0) + 1);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDay = new Date(today);
    const todayDow = today.getDay();
    endDay.setDate(endDay.getDate() + (6 - todayDow));

    const yearAgo = new Date(today);
    yearAgo.setMonth(yearAgo.getMonth() - 11);
    yearAgo.setDate(1);
    const startDay = new Date(yearAgo);
    startDay.setDate(startDay.getDate() - startDay.getDay());

    const weeks: { date: Date; count: number }[][] = [];
    const monthLabelsArr: { label: string; colIndex: number }[] = [];
    const seenMonths = new Set<number>();

    const cursor = new Date(startDay);
    let weekIdx = 0;
    let currentWeek: { date: Date; count: number }[] = [];

    while (cursor <= endDay) {
      const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
      const count = countMap.get(key) || 0;
      const isFuture = cursor > today;

      currentWeek.push({
        date: new Date(cursor),
        count: isFuture ? -1 : count,
      });

      const monthKey = cursor.getFullYear() * 12 + cursor.getMonth();
      if (cursor.getDate() === 1 && !seenMonths.has(monthKey)) {
        seenMonths.add(monthKey);
        monthLabelsArr.push({
          label: MONTH_LABELS[cursor.getMonth()],
          colIndex: weekIdx,
        });
      }

      if (cursor.getDay() === 6) {
        weeks.push(currentWeek);
        currentWeek = [];
        weekIdx++;
      }

      cursor.setDate(cursor.getDate() + 1);
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    let totalBlocks = 0;
    for (const [, c] of countMap) totalBlocks += c;

    return { weeks, monthLabels: monthLabelsArr, totalBlocks };
  }, [events]);

  const grid: { date: Date; count: number }[][] = Array.from(
    { length: 7 },
    () => [],
  );
  for (const week of weeks) {
    for (let row = 0; row < 7; row++) {
      grid[row].push(week[row] ?? { date: new Date(), count: -1 });
    }
  }

  const cols = weeks.length;
  const cell = 10;
  const gap = 3;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
      <div>
        {/* Month labels */}
        <div style={{ display: "flex", paddingLeft: 28, marginBottom: 2 }}>
          {monthLabels.map((m, i) => {
            const nextCol = monthLabels[i + 1]?.colIndex ?? cols;
            const span = nextCol - m.colIndex;
            return (
              <div
                key={i}
                className="text-muted-foreground"
                style={{
                  width: span * (cell + gap),
                  fontSize: 9,
                  flexShrink: 0,
                }}
              >
                {m.label}
              </div>
            );
          })}
        </div>

        {/* Grid rows */}
        {grid.map((row, rowIdx) => (
          <div
            key={rowIdx}
            style={{
              display: "flex",
              alignItems: "center",
              height: cell + gap,
            }}
          >
            <div
              className="text-muted-foreground"
              style={{
                width: 28,
                fontSize: 9,
                flexShrink: 0,
                visibility: rowIdx % 2 === 1 ? "visible" : "hidden",
              }}
            >
              {DAY_LABELS[rowIdx]}
            </div>

            {row.map((day, colIdx) => {
              const isFuture = day.count === -1;
              const level = isFuture ? -1 : getHeatLevel(day.count);
              const bg = isFuture
                ? isDark
                  ? "rgba(17,19,24,0.4)"
                  : "rgba(244,245,247,0.4)"
                : isDark
                  ? HEAT_COLORS[level][1]
                  : HEAT_COLORS[level][0];

              return (
                <div
                  key={colIdx}
                  title={
                    isFuture
                      ? ""
                      : `${day.date.toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}: ${day.count} block${day.count === 1 ? "" : "s"}`
                  }
                  style={{
                    width: cell,
                    height: cell,
                    borderRadius: 2,
                    backgroundColor: bg,
                    flexShrink: 0,
                    marginRight: gap,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Blocked {totalBlocks.toLocaleString()} distraction
        {totalBlocks === 1 ? "" : "s"} in the last year
      </p>
    </div>
  );
}

// ── Sites Tab ────────────────────────────────────────────────────────────────

function SitesTab({
  grouped,
  expandedDomains,
  toggleDomain,
  addRule,
  removeRule,
  updateRule,
  removeAllForDomain,
  input,
  setInput,
  showImport,
}: {
  grouped: [string, BlockRule[]][];
  expandedDomains: Set<string>;
  toggleDomain: (domain: string) => void;
  addRule: (pattern: string, source?: string) => void;
  removeRule: (id: string) => void;
  updateRule: (id: string, updates: Partial<BlockRule>) => void;
  removeAllForDomain: (domain: string) => void;
  input: string;
  setInput: (v: string) => void;
  showImport: boolean;
}) {
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());

  const allDomains = useMemo(() => grouped.map(([d]) => d), [grouped]);
  const hasSelection = selectedDomains.size > 0;
  const allSelected = allDomains.length > 0 && selectedDomains.size === allDomains.length;

  function toggleSelectDomain(domain: string) {
    setSelectedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedDomains(new Set());
    } else {
      setSelectedDomains(new Set(allDomains));
    }
  }

  async function deleteSelected() {
    const current = await blockRulesStorage.getValue();
    await blockRulesStorage.setValue(
      current.filter((r) => !selectedDomains.has(r.domain)),
    );
    setSelectedDomains(new Set());
  }

  const [showAddForm, setShowAddForm] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 200);

  const filteredGrouped = useMemo(() => {
    if (!debouncedSearch) return grouped;
    const q = debouncedSearch.toLowerCase();
    return grouped
      .map(([domain, rules]) => {
        if (domain.includes(q)) return [domain, rules] as [string, BlockRule[]];
        const filtered = rules.filter((r) => r.pattern.toLowerCase().includes(q));
        return filtered.length > 0 ? [domain, filtered] as [string, BlockRule[]] : null;
      })
      .filter(Boolean) as [string, BlockRule[]][];
  }, [grouped, debouncedSearch]);

  return (
    <div className="space-y-4">
      {/* Toolbar: search + add */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search sites..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm pl-8"
          />
        </div>
        <Button
          size="icon"
          className="shrink-0"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <Plus size={16} className={`transition-transform ${showAddForm ? "rotate-45" : ""}`} />
        </Button>
      </div>

      {/* Collapsible add form */}
      {showAddForm && (
        <div className="space-y-2">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addRule(input);
            }}
          >
            <Input
              autoFocus
              placeholder="e.g. reddit.com, *.twitter.com/notifications/*"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="text-sm"
            />
            <Button type="submit" variant="secondary">
              Add
            </Button>
          </form>
        </div>
      )}

      {/* Import panel */}
      {showImport && (
        <ImportPanel
          presets={sitePresets.map((p) => ({
            name: p.name,
            description: p.description,
            items: p.rules,
          }))}
          onImportItems={async (items, source) => {
            for (const item of items) await addRule(item, source);
          }}
          onImportFile={() => {
            const fileInput = document.createElement("input");
            fileInput.type = "file";
            fileInput.accept = ".json";
            fileInput.onchange = async () => {
              const file = fileInput.files?.[0];
              if (!file) return;
              try {
                const text = await file.text();
                const data = JSON.parse(text);
                const source = data.name || file.name.replace(/\.json$/, "");
                if (Array.isArray(data.rules)) {
                  for (const rule of data.rules) {
                    if (typeof rule === "string") {
                      await addRule(rule, source);
                    } else if (rule?.pattern) {
                      await addRule(rule.pattern, source);
                    }
                  }
                }
              } catch {}
            };
            fileInput.click();
          }}
          itemLabel="sites"
        />
      )}

      {/* Site list */}
      {filteredGrouped.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {debouncedSearch ? "No matching sites found." : "No sites blocked yet."}
        </p>
      ) : (
        <div>
          {/* Table header — shown when items are selected */}
          {hasSelection && (
            <SelectionHeader
              count={selectedDomains.size}
              allSelected={allSelected}
              onToggleAll={toggleSelectAll}
              onExport={async () => {
                const current = await blockRulesStorage.getValue();
                const selectedRules = current.filter((r) =>
                  selectedDomains.has(r.domain),
                );
                const config = {
                  name: "Focus Mode Export",
                  description: "Exported block rules",
                  rules: selectedRules.map((r) => ({
                    pattern: r.pattern,
                    timerSeconds: r.timerSeconds,
                    accessLimit: r.accessLimit,
                    limitPeriod: r.limitPeriod,
                    browseSeconds: r.browseSeconds ?? 0,
                  })),
                };
                const blob = new Blob([JSON.stringify(config, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "focus-mode-config.json";
                a.click();
                URL.revokeObjectURL(url);
              }}
              onDelete={deleteSelected}
            />
          )}
          {filteredGrouped.map(([domain, domainRules], idx) => {
            const isExpanded = expandedDomains.has(domain);
            const isLast = idx === filteredGrouped.length - 1;
            const isDomainSelected = selectedDomains.has(domain);
            return (
              <div key={domain} className={`group/domain ${isLast ? "" : "border-b"}`}>
                <div
                  className="flex items-center gap-2 px-2 py-3 -mx-2 rounded hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => toggleDomain(domain)}
                >
                  {/* Checkbox — visible on hover or when any selection exists */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelectDomain(domain);
                    }}
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                      isDomainSelected
                        ? "bg-foreground border-foreground"
                        : "border-input"
                    } ${hasSelection ? "opacity-100" : "opacity-0 group-hover/domain:opacity-100"}`}
                  >
                    {isDomainSelected && <Check size={10} className="text-background" />}
                  </button>

                  <div className="flex items-center gap-3 flex-1">
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                      alt=""
                      className="w-4 h-4 rounded-sm"
                    />
                    <span className="text-sm font-medium flex-1 text-left">
                      {domain}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {domainRules.length}{" "}
                      {domainRules.length === 1 ? "rule" : "rules"}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </div>
                </div>

                {isExpanded && (
                  <div className="pl-8 pb-3 space-y-2">
                    {domainRules.map((rule, ruleIdx) => (
                      <RuleRow
                        key={rule.id}
                        rule={rule}
                        isLast={ruleIdx === domainRules.length - 1}
                        isOnlyRule={domainRules.length === 1}
                        onRemove={() => removeRule(rule.id)}
                        onUpdate={(u) => updateRule(rule.id, u)}
                      />
                    ))}
                    <div className="flex justify-between pt-1">
                      <AddSubRuleInput domain={domain} onAdd={addRule} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SelectionHeader({
  count,
  allSelected,
  onToggleAll,
  onExport,
  onDelete,
}: {
  count: number;
  allSelected: boolean;
  onToggleAll: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 py-2 border-b">
      <button
        onClick={onToggleAll}
        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
          allSelected
            ? "bg-foreground border-foreground"
            : "border-input"
        }`}
      >
        {allSelected && <Check size={10} className="text-background" />}
      </button>

      <span className="text-xs text-muted-foreground flex-1">
        {count} site{count === 1 ? "" : "s"} selected
      </span>

      <button
        onClick={onExport}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
      >
        <Upload size={12} />
        Export
      </button>

      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
        >
          <EllipsisVertical size={14} />
        </button>
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-full mt-1 z-20 rounded-md border bg-popover shadow-md py-1 min-w-[140px]">
              <button
                onClick={() => {
                  onDelete();
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-muted transition-colors text-left"
              >
                <Trash2 size={13} />
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ImportPanel({
  presets,
  onImportItems,
  onImportFile,
  itemLabel,
}: {
  presets: { name: string; description: string; items: string[] }[];
  onImportItems: (items: string[], source: string) => void;
  onImportFile: () => void;
  itemLabel: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
      <p className="text-xs text-muted-foreground">
        Choose a preset or import your own
      </p>

      {presets.map((preset) => {
        const isExpanded = expanded.has(preset.name);
        return (
          <div key={preset.name} className="rounded-md border bg-background">
            <div
              className="flex items-center justify-between px-3 py-2 cursor-pointer rounded-md"
              onClick={() =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(preset.name)) next.delete(preset.name);
                  else next.add(preset.name);
                  return next;
                })
              }
            >
              <div className="flex items-center gap-2">
                <ChevronDown
                  size={12}
                  className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                />
                <div>
                  <p className="text-sm font-medium">{preset.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {preset.items.length} {itemLabel}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onImportItems(preset.items, preset.name);
                }}
              >
                <Plus size={12} />
                Add all
              </Button>
            </div>

            {isExpanded && (
              <div className="px-3 pb-2.5 pt-0.5">
                <div className="flex flex-wrap gap-1.5">
                  {preset.items.map((item) => (
                    <span
                      key={item}
                      className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={onImportFile}
        className="w-full flex items-center justify-center gap-1.5 rounded-md border border-dashed py-2 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
      >
        <Upload size={12} />
        Import from file
      </button>
    </div>
  );
}

function UnitPicker<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        {current?.label ?? value}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 rounded-md border bg-popover shadow-md py-1 min-w-[70px]">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-1 text-xs hover:bg-muted transition-colors ${
                  opt.value === value ? "font-medium" : "text-muted-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RuleRow({
  rule,
  isLast,
  isOnlyRule,
  onRemove,
  onUpdate,
}: {
  rule: BlockRule;
  isLast: boolean;
  isOnlyRule: boolean;
  onRemove: () => void;
  onUpdate: (updates: Partial<BlockRule>) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const timer = secondsToTimer(rule.timerSeconds);
  const browseTimer = secondsToTimer(rule.browseSeconds ?? 0);

  return (
    <div className={`px-1 py-2.5 space-y-2 ${isLast ? "" : "border-b"}`}>
      {/* Row 1: pattern + badges + menu */}
      <div className="flex items-center gap-2">
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
          {rule.pattern}
        </code>
        {rule.isException && (
          <span className="text-[10px] text-green-600 dark:text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">
            Allow
          </span>
        )}
        {rule.source && (
          <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
            {rule.source}
          </span>
        )}
        <div className="relative ml-auto">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
            >
              <EllipsisVertical size={14} />
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-20 rounded-md border bg-popover shadow-md py-1 min-w-[180px]">
                  <button
                    onClick={() => {
                      onUpdate({ isException: !rule.isException });
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted transition-colors text-left"
                  >
                    <Check size={13} className={rule.isException ? "" : "opacity-0"} />
                    Exception (allow)
                  </button>
                  <button
                    onClick={() => {
                      onRemove();
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-muted transition-colors text-left"
                  >
                    <Trash2 size={13} />
                    {isOnlyRule ? "Remove block" : "Delete rule"}
                  </button>
                </div>
              </>
            )}
          </div>
      </div>

      {/* Row 2: session config */}
      {!rule.isException && (() => {
        const hasLimit = rule.accessLimit > 0;
        const dimmed = !hasLimit ? "opacity-40 pointer-events-none" : "";
        return (
          <div className="flex items-center gap-4 pl-1">
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={0}
                value={rule.accessLimit}
                onChange={(e) =>
                  onUpdate({ accessLimit: parseInt(e.target.value) || 0 })
                }
                className="text-xs h-6 w-14 text-center"
              />
              <span className="text-[10px] text-muted-foreground">sessions</span>
              <UnitPicker
                value={rule.limitPeriod}
                options={LIMIT_PERIODS}
                onChange={(period) => onUpdate({ limitPeriod: period })}
              />
            </div>

            <div className={`flex items-center gap-1.5 ${dimmed}`}>
              <label className="text-[10px] text-muted-foreground">Challenge</label>
              <Input
                type="number"
                min={0}
                value={timer.value}
                onChange={(e) =>
                  onUpdate({
                    timerSeconds: timerToSeconds(parseInt(e.target.value) || 0, timer.unit),
                  })
                }
                className="text-xs h-6 w-14 text-center"
              />
              <UnitPicker
                value={timer.unit}
                options={TIMER_UNITS}
                onChange={(unit) =>
                  onUpdate({ timerSeconds: timerToSeconds(timer.value, unit) })
                }
              />
            </div>

            <div className={`flex items-center gap-1.5 ${dimmed}`}>
              <label className="text-[10px] text-muted-foreground">Session</label>
              <Input
                type="number"
                min={0}
                value={browseTimer.value}
                onChange={(e) =>
                  onUpdate({
                    browseSeconds: timerToSeconds(parseInt(e.target.value) || 0, browseTimer.unit),
                  })
                }
                className="text-xs h-6 w-14 text-center"
              />
              <UnitPicker
                value={browseTimer.unit}
                options={TIMER_UNITS}
                onChange={(unit) =>
                  onUpdate({ browseSeconds: timerToSeconds(browseTimer.value, unit) })
                }
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function AddSubRuleInput({
  domain,
  onAdd,
}: {
  domain: string;
  onAdd: (pattern: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className="flex gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) {
          let pattern = value.trim();
          // If the user typed a relative path or slug, prefix with the domain
          if (!pattern.includes(".")) {
            pattern = pattern.startsWith("/") ? pattern : "/" + pattern;
            pattern = domain + pattern;
          }
          onAdd(pattern);
          setValue("");
        }
      }}
    >
      <Input
        placeholder={`e.g. ${domain}/path/*`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="text-xs h-7 w-48"
      />
      <Button type="submit" variant="ghost" size="sm" className="h-7 text-xs">
        <Plus size={12} />
        Add rule
      </Button>
    </form>
  );
}

// ── Prompts Tab ──────────────────────────────────────────────────────────────

function PromptsTab({ config, showImport }: { config: PromptConfig; showImport: boolean }) {
  const [newPrompt, setNewPrompt] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // Build unified list: custom prompts + defaults (with stable ids)
  const customPrompts = Array.isArray(config.prompts) ? config.prompts : [];
  const excludedDefaults = new Set(config.excludedDefaults ?? []);
  const allPrompts: (PromptEntry & { isDefault: boolean; defaultIndex?: number })[] = useMemo(() => {
    const items: (PromptEntry & { isDefault: boolean; defaultIndex?: number })[] = customPrompts.map(
      (p) => ({ ...p, isDefault: false }),
    );
    for (let i = 0; i < defaultPrompts.length; i++) {
      if (!excludedDefaults.has(i)) {
        items.push({
          id: `default-${i}`,
          text: defaultPrompts[i],
          source: "Default",
          isDefault: true,
          defaultIndex: i,
        });
      }
    }
    return items;
  }, [customPrompts, config.excludedDefaults]);

  const allIds = allPrompts.map((p) => p.id);
  const hasSelection = selected.size > 0;
  const allSelected = allIds.length > 0 && selected.size === allIds.length;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  async function addPrompt(text?: string, source?: string) {
    const clean = (text ?? newPrompt).trim();
    if (!clean) return;
    const current = await promptConfigStorage.getValue();
    if (current.prompts.some((p) => p.text === clean)) return;
    await promptConfigStorage.setValue({
      ...current,
      prompts: [
        ...current.prompts,
        { id: generateId(), text: clean, ...(source ? { source } : {}) },
      ],
    });
    if (!text) setNewPrompt("");
  }

  async function removePrompt(id: string) {
    const current = await promptConfigStorage.getValue();
    if (id.startsWith("default-")) {
      const idx = parseInt(id.replace("default-", ""));
      const excluded = new Set(current.excludedDefaults ?? []);
      excluded.add(idx);
      await promptConfigStorage.setValue({
        ...current,
        excludedDefaults: [...excluded],
      });
    } else {
      const prompts = Array.isArray(current.prompts) ? current.prompts : [];
      await promptConfigStorage.setValue({
        ...current,
        prompts: prompts.filter((p) => p.id !== id),
      });
    }
  }

  async function updatePrompt(id: string, text: string) {
    const current = await promptConfigStorage.getValue();
    await promptConfigStorage.setValue({
      ...current,
      prompts: current.prompts.map((p) =>
        p.id === id ? { ...p, text } : p,
      ),
    });
    setEditingId(null);
  }

  async function deleteSelected() {
    const current = await promptConfigStorage.getValue();
    const currentPrompts = Array.isArray(current.prompts) ? current.prompts : [];
    const currentExcluded = new Set(current.excludedDefaults ?? []);

    // Find which selected items are defaults vs custom
    for (const id of selected) {
      if (id.startsWith("default-")) {
        const idx = parseInt(id.replace("default-", ""));
        currentExcluded.add(idx);
      }
    }

    await promptConfigStorage.setValue({
      ...current,
      prompts: currentPrompts.filter((p) => !selected.has(p.id)),
      excludedDefaults: [...currentExcluded],
    });
    setSelected(new Set());
  }

  function exportPrompts(promptsToExport: PromptEntry[]) {
    const data = {
      name: "Focus Mode Prompts",
      prompts: promptsToExport.map((p) => p.text),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "focus-mode-prompts.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importPromptsFromFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const sourceName = data.name || file.name.replace(/\.json$/, "");
        if (Array.isArray(data.prompts)) {
          for (const p of data.prompts) {
            if (typeof p === "string") await addPrompt(p, sourceName);
          }
        }
      } catch {}
    };
    input.click();
  }

  const [showAddForm, setShowAddForm] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 200);

  const filteredPrompts = useMemo(() => {
    if (!debouncedSearch) return allPrompts;
    const q = debouncedSearch.toLowerCase();
    return allPrompts.filter((p) => p.text.toLowerCase().includes(q));
  }, [allPrompts, debouncedSearch]);

  return (
    <div className="space-y-4">
      {/* Toolbar: search + add */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search prompts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm pl-8"
          />
        </div>
        <Button
          size="icon"
          className="shrink-0"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <Plus size={16} className={`transition-transform ${showAddForm ? "rotate-45" : ""}`} />
        </Button>
      </div>

      {/* Collapsible add form */}
      {showAddForm && (
        <form
          className="relative rounded-md border border-input bg-background"
          onSubmit={(e) => {
            e.preventDefault();
            addPrompt();
          }}
        >
          <Textarea
            autoFocus
            placeholder="Write a reflection prompt, e.g. What's one thing you're grateful for?"
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                addPrompt();
              }
            }}
            className="resize-none border-0 shadow-none focus-visible:ring-0 text-sm pb-10 min-h-0"
            rows={1}
          />
          <div className="absolute bottom-2 right-2">
            <button
              type="submit"
              disabled={!newPrompt.trim()}
              className="rounded-md bg-foreground p-1.5 text-background transition-opacity disabled:opacity-30 hover:opacity-80"
            >
              <Plus size={14} />
            </button>
          </div>
        </form>
      )}

      {/* Import panel */}
      {showImport && (
        <ImportPanel
          presets={promptPresets.map((p) => ({
            name: p.name,
            description: p.description,
            items: p.prompts,
          }))}
          onImportItems={async (items, source) => {
            for (const item of items) await addPrompt(item, source);
          }}
          onImportFile={importPromptsFromFile}
          itemLabel="prompts"
        />
      )}

      {/* Selection header */}
      {hasSelection && (
        <div className="flex items-center gap-3 px-1 py-2 border-b">
          <button
            onClick={toggleSelectAll}
            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
              allSelected
                ? "bg-foreground border-foreground"
                : "border-input"
            }`}
          >
            {allSelected && <Check size={10} className="text-background" />}
          </button>
          <span className="text-xs text-muted-foreground flex-1">
            {selected.size} prompt{selected.size === 1 ? "" : "s"} selected
          </span>
          <button
            onClick={() =>
              exportPrompts(config.prompts.filter((p) => selected.has(p.id)))
            }
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Upload size={12} />
            Export
          </button>
          <div className="relative">
            <PromptSelectionMenu onDelete={deleteSelected} />
          </div>
        </div>
      )}

      {/* Prompt list — unified */}
      {filteredPrompts.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {debouncedSearch ? "No matching prompts found." : "No prompts configured."}
        </p>
      ) : (
        <div>
          {filteredPrompts.map((p, i) => (
            <div
              key={p.id}
              className={`group/prompt flex items-start gap-3 py-2.5 -mx-2 px-2 rounded hover:bg-muted/50 transition-colors ${
                i < filteredPrompts.length - 1 ? "border-b" : ""
              }`}
            >
              {/* Checkbox */}
              <button
                onClick={() => toggleSelect(p.id)}
                className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                  selected.has(p.id)
                    ? "bg-foreground border-foreground"
                    : "border-input"
                } ${hasSelection ? "opacity-100" : "opacity-0 group-hover/prompt:opacity-100"}`}
              >
                {selected.has(p.id) && (
                  <Check size={10} className="text-background" />
                )}
              </button>

              {/* Text — editable on click (not for defaults) */}
              {editingId === p.id && !p.isDefault ? (
                <form
                  className="flex-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    updatePrompt(p.id, editText);
                  }}
                >
                  <Input
                    autoFocus
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={() => updatePrompt(p.id, editText)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="text-sm h-7"
                  />
                </form>
              ) : (
                <p
                  className={`text-sm flex-1 ${p.isDefault ? "" : "cursor-pointer"}`}
                  onClick={() => {
                    if (!p.isDefault) {
                      setEditingId(p.id);
                      setEditText(p.text);
                    }
                  }}
                >
                  {p.text}
                </p>
              )}

              {/* Source label + delete */}
              <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                {p.source && (
                  <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                    {p.source}
                  </span>
                )}
                <button
                  onClick={() => removePrompt(p.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover/prompt:opacity-100"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PromptSelectionMenu({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
      >
        <EllipsisVertical size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 rounded-md border bg-popover shadow-md py-1 min-w-[140px]">
            <button
              onClick={() => {
                onDelete();
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-muted transition-colors text-left"
            >
              <Trash2 size={13} />
              Delete
            </button>
          </div>
        </>
      )}
    </>
  );
}

export default App;
