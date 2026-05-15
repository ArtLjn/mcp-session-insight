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
