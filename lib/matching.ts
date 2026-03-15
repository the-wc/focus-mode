import type { BlockRule } from "./storage";

/**
 * Convert a block pattern to a regex.
 *
 * Supported patterns:
 *   "reddit.com"              — matches reddit.com and www.reddit.com
 *   "*.reddit.com"            — matches any subdomain of reddit.com
 *   "reddit.com/r/funny"      — matches that exact path prefix
 *   "reddit.com/r/funny/*"    — matches anything under that path
 *   "*.example.com/app/*"     — subdomain wildcard + path wildcard
 */
function patternToRegex(pattern: string): RegExp {
  // Remove protocol if someone typed it
  let p = pattern.replace(/^https?:\/\//, "");

  // Split into host and path parts
  const slashIdx = p.indexOf("/");
  let hostPart = slashIdx === -1 ? p : p.slice(0, slashIdx);
  let pathPart = slashIdx === -1 ? "" : p.slice(slashIdx);

  // Build host regex
  let hostRegex: string;
  if (hostPart.startsWith("*.")) {
    // *.example.com → match any subdomain (including none via www)
    const base = escapeRegex(hostPart.slice(2));
    hostRegex = `(?:[a-z0-9-]+\\.)*${base}`;
  } else {
    // "reddit.com" → also match "www.reddit.com"
    hostRegex = `(?:www\\.)?${escapeRegex(hostPart)}`;
  }

  // Build path regex
  let pathRegex: string;
  if (!pathPart) {
    pathRegex = "(?:/.*)?"; // match any path
  } else {
    // Replace wildcards in path
    pathRegex = pathPart
      .split("*")
      .map(escapeRegex)
      .join(".*");
    // Allow trailing content if pattern doesn't end with wildcard
    if (!pathPart.endsWith("*")) {
      pathRegex += ".*";
    }
  }

  return new RegExp(`^${hostRegex}${pathRegex}$`, "i");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface MatchResult {
  matched: boolean;
  rule: BlockRule | null;
}

/**
 * Check if a URL matches any block rule.
 * Exceptions are checked first — if any exception matches, returns null.
 * Returns the first matching block rule or null.
 */
export function findMatchingRule(
  url: string,
  rules: BlockRule[],
): BlockRule | null {
  let normalized = url.replace(/^https?:\/\//, "");
  if (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  // Check exceptions first — if any exception matches, allow through
  for (const rule of rules) {
    if (rule.isException) {
      const regex = patternToRegex(rule.pattern);
      if (regex.test(normalized)) return null;
    }
  }

  for (const rule of rules) {
    if (rule.isException) continue;
    const regex = patternToRegex(rule.pattern);
    if (regex.test(normalized)) {
      return rule;
    }
  }
  return null;
}
