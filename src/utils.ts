import { homedir } from 'os';
import { join } from 'path';

export const CLAUDE_HOME = join(homedir(), '.claude');
export const PROJECTS_DIR = join(CLAUDE_HOME, 'projects');

/** Decode Claude Code's path encoding: -Users-ljn-... → /Users/ljn/... */
export function decodeProjectPath(encoded: string): string {
  if (!encoded.startsWith('-')) return encoded;
  return '/' + encoded.slice(1).replace(/-/g, '/');
}

/** Encode path to Claude Code format: /Users/ljn/.claude → -Users-ljn--claude */
export function encodeProjectPath(path: string): string {
  return path.replace(/[^a-zA-Z0-9]/g, '-');
}

/** Parse ISO string or millisecond timestamp to ISO format */
export function parseTimestamp(ts: string | number): string {
  if (typeof ts === 'number') {
    return new Date(ts).toISOString();
  }
  try {
    return new Date(ts).toISOString();
  } catch {
    return String(ts);
  }
}

/** Extract plain text from Claude message content */
export function extractTextFromMessage(msg: Record<string, unknown>): string {
  const content = msg.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const item of content) {
      if (typeof item === 'object' && item !== null && 'type' in item) {
        const dict = item as Record<string, unknown>;
        if (dict.type === 'text' && typeof dict.text === 'string') {
          parts.push(dict.text);
        }
      }
    }
    return parts.join('\n');
  }
  return '';
}

/** Shorten absolute path to relative or ~ form */
export function shortPath(fp: string, cwd: string = ''): string {
  if (cwd && fp.startsWith(cwd + '/')) {
    return fp.slice(cwd.length + 1);
  }
  const home = homedir() + '/';
  if (fp.startsWith(home)) {
    return '~/' + fp.slice(home.length);
  }
  return fp;
}

/** Truncate text with optional suffix, strip HTML-like tags */
export function truncate(text: string, maxLen: number = 50, suffix: string = '...'): string {
  text = text.replace(/<[^>]+>/g, '').trim();
  text = text.replace(/\s+/g, ' ');
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - suffix.length) + suffix;
}

/** Extract character trigrams from a string */
export function trigrams(s: string): string[] {
  if (s.length < 3) return [];
  const result: string[] = [];
  for (let i = 0; i <= s.length - 3; i++) {
    result.push(s.slice(i, i + 3));
  }
  return result;
}

/** Compute Jaccard similarity between two strings using trigrams */
export function jaccardTrigram(a: string, b: string): number {
  const tA = trigrams(a.toLowerCase().trim());
  const tB = trigrams(b.toLowerCase().trim());
  if (tA.length === 0 && tB.length === 0) return 0;
  const setB = new Set(tB);
  const intersection = tA.filter(t => setB.has(t)).length;
  const union = new Set([...tA, ...tB]).size;
  return union === 0 ? 0 : intersection / union;
}

/** Deduplicate strings by Jaccard trigram similarity (keep first occurrence) */
export function dedupByTrigram(items: string[], threshold = 0.4): string[] {
  const result: string[] = [];
  for (const item of items) {
    const cleaned = item.trim();
    if (!cleaned) continue;
    const isDup = result.some(r => jaccardTrigram(r, cleaned) >= threshold);
    if (!isDup) result.push(cleaned);
  }
  return result;
}
