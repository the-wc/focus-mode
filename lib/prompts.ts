import { promptConfigStorage } from "./storage";

export const defaultPrompts = [
  "What's one thing you're grateful for right now?",
  "What's the most important thing you could do in the next 30 minutes?",
  "Who is someone that made your day better recently?",
  "What's something small that brought you joy today?",
  "What's one goal you're working towards right now?",
  "What would make today a great day?",
  "What's a recent accomplishment you're proud of?",
  "What's something kind you could do for someone today?",
  "What's one thing you'd like to learn this week?",
  "What matters most to you right now?",
];

export const MIN_RESPONSE_LENGTH = 20;

// Lazy genuineness heuristic: catch keyboard-mashing / one-word dodges, not an essay grader.
// ponytail: heuristic, swap for an LLM check if people game it.
export function checkResponse(text: string): { ok: boolean; reason?: string } {
  const trimmed = text.trim();
  if (trimmed.length < MIN_RESPONSE_LENGTH) {
    return { ok: false, reason: `At least ${MIN_RESPONSE_LENGTH} characters` };
  }
  if (trimmed.split(/\s+/).length < 3) {
    return { ok: false, reason: "Write a full sentence" };
  }
  const letters = trimmed.toLowerCase().replace(/[^a-z]/g, "");
  const vowels = (letters.match(/[aeiou]/g) ?? []).length;
  if (letters.length === 0 || vowels / letters.length < 0.2 || new Set(letters).size < 5) {
    return { ok: false, reason: "Use real words" };
  }
  return { ok: true };
}

export async function getRandomPrompt(): Promise<string> {
  const config = await promptConfigStorage.getValue();
  const pool: string[] = [];
  const excluded = new Set(config.excludedDefaults ?? []);
  for (let i = 0; i < defaultPrompts.length; i++) {
    if (!excluded.has(i)) pool.push(defaultPrompts[i]);
  }
  const prompts = Array.isArray(config.prompts) ? config.prompts : [];
  pool.push(...prompts.map((p) => (typeof p === "string" ? p : p.text)));
  if (pool.length === 0) return "Take a moment to reflect before continuing.";
  return pool[Math.floor(Math.random() * pool.length)];
}
