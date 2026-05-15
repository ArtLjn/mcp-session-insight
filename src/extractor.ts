import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import type { WorkSummary } from './models.js';

const GIT_COMMANDS = [
  'git commit',
  'git push',
  'git pull',
  'git merge',
  'git rebase',
  'git checkout',
  'git branch',
  'git add',
  'git status',
  'git log',
  'git diff',
  'git reset',
  'git stash',
  'git tag',
  'git fetch',
  'git clone',
];

const NOISE_PATTERNS = [
  /^ok$/i,
  /^好的$/,
  /^没问题$/,
  /^可以$/,
  /^嗯$/,
  /^行$/,
  /^<ide_opened_file>/,
  /^<skill_expanded>/,
  /^\s*$/,
];

const ERROR_PATTERNS = [
  /Traceback \(most recent call last\)/i,
  /SyntaxError/i,
  /ImportError/i,
  /ModuleNotFoundError/i,
  /TypeError/i,
  /ValueError/i,
  /KeyError/i,
  /AttributeError/i,
  /NameError/i,
  /RuntimeError/i,
  /AssertionError/i,
  /IndexError/i,
  /ZeroDivisionError/i,
  /FileNotFoundError/i,
  /PermissionError/i,
  /OSError/i,
  /IOError/i,
  /ConnectionError/i,
  /TimeoutError/i,
  /Error:/i,
  /FAILED/i,
  /Exception:/i,
  /Uncaught/i,
  /Unhandled/i,
  /fatal:/i,
  /error:/i,
];

const DECISION_KEYWORDS = [
  '决定',
  'decision',
  'conclusion',
  'conclude',
  'resolved to',
  'decided to',
  'plan to',
  'will use',
  '选择',
  '采用',
  '方案',
  '最终确定',
  '最终选择',
  '确定使用',
];

/** Check if user message is noise */
export function isNoise(text: string): boolean {
  const t = text.trim();
  for (const p of NOISE_PATTERNS) {
    if (p.test(t)) return true;
  }
  return false;
}

/** Detect error/issue in text */
export function isErrorOrIssue(text: string): boolean {
  for (const p of ERROR_PATTERNS) {
    if (p.test(text)) return true;
  }
  return false;
}

/** Classify bash command into git action or regular command */
export function classifyBashCommand(cmd: string, result: WorkSummary): void {
  const trimmed = cmd.trim();
  const lower = trimmed.toLowerCase();
  let isGit = false;
  for (const prefix of GIT_COMMANDS) {
    if (lower.startsWith(prefix)) {
      isGit = true;
      break;
    }
  }
  if (isGit) {
    result.gitActions.push(trimmed);
  } else {
    result.bashCommands.push(trimmed);
  }
}

/** Create a hash for deduplicating todo snapshots */
function hashString(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

/** Format a todo snapshot string */
export function snapshotTodos(todos: Array<Record<string, string>>): string {
  const lines: string[] = [];
  for (const todo of todos) {
    const status = todo.status || 'pending';
    const content = todo.content || '';
    lines.push(`[${status}] ${content}`);
  }
  return lines.join('\n');
}

/** Extract decisions from thinking text */
export function extractDecisions(thinking: string, result: WorkSummary): void {
  const lines = thinking.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    for (const kw of DECISION_KEYWORDS) {
      if (trimmed.toLowerCase().includes(kw.toLowerCase())) {
        result.decisions.push(trimmed);
        break;
      }
    }
  }
}

/** Flush accumulated assistant texts into summaries */
export function flushAssistantTexts(texts: string[], result: WorkSummary): void {
  if (texts.length === 0) return;
  const merged = texts.join('\n').trim();
  if (!merged) return;
  result.assistantSummaries.push(merged);
  if (isErrorOrIssue(merged)) {
    result.errorsOrIssues.push(merged);
  }
}

/** Extract structured work summary from a JSONL file */
export function extractWorkSummary(jsonlPath: string): WorkSummary {
  const result: WorkSummary = {
    filesModified: {},
    filesCreated: [],
    filesRead: [],
    toolStats: {},
    userRequests: [],
    assistantSummaries: [],
    bashCommands: [],
    todoSnapshots: [],
    errorsOrIssues: [],
    decisions: [],
    gitActions: [],
  };

  const seenTodoHashes = new Set<string>();
  const seenFilesCreated = new Set<string>();

  let content: string;
  try {
    content = readFileSync(jsonlPath, 'utf-8');
  } catch {
    return result;
  }

  let assistantTexts: string[] = [];

  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }

    const msgType = String(obj.type || '');
    const message = (obj.message as Record<string, unknown>) || {};
    const msgContent = message.content;

    if (msgType === 'user') {
      const text = extractTextFromContent(msgContent);
      if (text && !isNoise(text)) {
        result.userRequests.push(text.trim());
      }
      continue;
    }

    if (msgType !== 'assistant') continue;

    if (Array.isArray(msgContent)) {
      for (const item of msgContent) {
        if (typeof item !== 'object' || item === null) continue;
        const dict = item as Record<string, unknown>;
        const itemType = String(dict.type || '');

        if (itemType === 'tool_use') {
          const name = String(dict.name || '');
          if (name) {
            result.toolStats[name] = (result.toolStats[name] || 0) + 1;
          }

          const input = (dict.input as Record<string, unknown>) || {};
          const filePath = String(input.file_path || '');

          if (name === 'Write' && filePath) {
            if (!seenFilesCreated.has(filePath)) {
              seenFilesCreated.add(filePath);
              result.filesCreated.push(filePath);
            }
          } else if (name === 'Edit' && filePath) {
            result.filesModified[filePath] = (result.filesModified[filePath] || 0) + 1;
          } else if ((name === 'Read' || name === 'Glob') && filePath) {
            result.filesRead.push(filePath);
          } else if (name === 'Bash') {
            const cmd = String(input.command || '');
            if (cmd) {
              classifyBashCommand(cmd, result);
            }
          } else if (name === 'TodoWrite') {
            const todos = input.todos as Array<Record<string, string>> | undefined;
            if (todos && Array.isArray(todos)) {
              const snapshot = snapshotTodos(todos);
              const h = hashString(snapshot);
              if (!seenTodoHashes.has(h)) {
                seenTodoHashes.add(h);
                result.todoSnapshots.push(snapshot);
              }
            }
          }
        } else if (itemType === 'text') {
          const text = String(dict.text || '');
          if (text) {
            assistantTexts.push(text);
          }
        } else if (itemType === 'thinking') {
          const thinking = String(dict.thinking || '');
          if (thinking) {
            extractDecisions(thinking, result);
          }
        }
      }
    } else if (typeof msgContent === 'string') {
      const text = msgContent;
      if (text) {
        assistantTexts.push(text);
      }
    }

    if (assistantTexts.length > 0) {
      flushAssistantTexts(assistantTexts, result);
      assistantTexts = [];
    }
  }

  // Post-process: deduplicate, sort, limit
  result.filesCreated = [...new Set(result.filesCreated)];
  result.filesRead = [...new Set(result.filesRead)];

  // Limit arrays
  result.bashCommands = result.bashCommands.slice(-30);
  result.assistantSummaries = result.assistantSummaries.slice(-15);
  result.userRequests = result.userRequests.slice(-50);
  result.todoSnapshots = result.todoSnapshots.slice(-5);
  result.errorsOrIssues = result.errorsOrIssues.slice(-10);
  result.decisions = result.decisions.slice(-10);
  result.gitActions = result.gitActions.slice(-15);

  return result;
}

/** Extract text from message content (string or array) */
function extractTextFromContent(content: unknown): string {
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
