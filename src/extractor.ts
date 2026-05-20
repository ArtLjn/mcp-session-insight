import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { dirname, basename } from 'path';
import { BashCategory } from './models.js';
import type { WorkSummary, EnrichedSummary, ProcessingContext, FileChangeGroup } from './models.js';
import { jaccardTrigram } from './utils.js';

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

/** Classification rules: [pattern, category] — checked in order, first match wins */
const BASH_RULES: Array<[RegExp, BashCategory]> = [
  [/^\s*git\s/, BashCategory.GIT],
  [/^\s*npm\s+test/, BashCategory.TEST],
  [/^\s*vitest/, BashCategory.TEST],
  [/^\s*jest/, BashCategory.TEST],
  [/^\s*pytest/, BashCategory.TEST],
  [/^\s*go\s+test/, BashCategory.TEST],
  [/^\s*cargo\s+test/, BashCategory.TEST],
  [/^\s*npm\s+run\s+build/, BashCategory.BUILD],
  [/^\s*tsc/, BashCategory.BUILD],
  [/^\s*webpack/, BashCategory.BUILD],
  [/^\s*rollup/, BashCategory.BUILD],
  [/^\s*esbuild/, BashCategory.BUILD],
  [/^\s*npm\s+run\s+dev/, BashCategory.DEBUG],
  [/^\s*nodemon/, BashCategory.DEBUG],
  [/^\s*docker\s/, BashCategory.DEPLOY],
  [/^\s*kubectl\s/, BashCategory.DEPLOY],
  [/^\s*helm\s/, BashCategory.DEPLOY],
  [/^\s*curl\s/, BashCategory.NETWORK],
  [/^\s*wget\s/, BashCategory.NETWORK],
  [/^\s*ping\s/, BashCategory.NETWORK],
  [/^\s*ssh\s/, BashCategory.NETWORK],
  [/^\s*scp\s/, BashCategory.NETWORK],
  [/^\s*ls\s/, BashCategory.EXPLORE],
  [/^\s*find\s/, BashCategory.EXPLORE],
  [/^\s*tree\s/, BashCategory.EXPLORE],
  [/^\s*node\s/, BashCategory.RUN],
  [/^\s*python\s/, BashCategory.RUN],
  [/^\s*python3\s/, BashCategory.RUN],
  [/^\s*go\s+run/, BashCategory.RUN],
  [/^\s*cargo\s+run/, BashCategory.RUN],
];

/** Classify a bash command by semantic category */
export function classifyBashCategory(cmd: string): BashCategory {
  const trimmed = cmd.trim();
  for (const [pattern, category] of BASH_RULES) {
    if (pattern.test(trimmed)) return category;
  }
  return BashCategory.OTHER;
}

/** Classify bash command into git action or regular command (legacy, for WorkSummary) */
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
export function extractDecisions(thinking: string, result: { decisions: string[] }): void {
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

/** Group file paths by directory */
function groupFilesByDir(
  created: string[],
  modified: Record<string, number>,
  cwd: string = '',
): FileChangeGroup[] {
  const groupMap = new Map<string, FileChangeGroup>();

  for (const fp of created) {
    const dir = dirname(fp).replace(cwd + '/', '').replace(cwd, '') || './';
    if (!groupMap.has(dir)) groupMap.set(dir, { directory: dir, created: [], modified: [] });
    groupMap.get(dir)!.created.push(basename(fp));
  }

  for (const [fp, count] of Object.entries(modified)) {
    const dir = dirname(fp).replace(cwd + '/', '').replace(cwd, '') || './';
    if (!groupMap.has(dir)) groupMap.set(dir, { directory: dir, created: [], modified: [] });
    groupMap.get(dir)!.modified.push({ file: basename(fp), count });
  }

  return [...groupMap.values()];
}

/** Deduplicate strings by Jaccard trigram similarity */
function dedupByJaccard(items: string[], threshold = 0.4): string[] {
  const result: string[] = [];
  for (const item of items) {
    const cleaned = item.trim();
    if (!cleaned) continue;
    const isDup = result.some(r => jaccardTrigram(r, cleaned) >= threshold);
    if (!isDup) result.push(cleaned);
  }
  return result;
}

/** Format session duration */
function formatDuration(start: Date, end: Date): string {
  const mins = Math.round((end.getTime() - start.getTime()) / 60000);
  if (mins < 1) return '<1min';
  if (mins < 5) return '<5min';
  return `${mins}min`;
}

/** Compute message density */
function computeDensity(count: number, start: Date, end: Date): string {
  const mins = (end.getTime() - start.getTime()) / 60000;
  if (mins === 0) return 'low';
  const rate = count / mins;
  if (rate > 2) return 'high';
  if (rate > 0.5) return 'medium';
  return 'low';
}

/** Extract enriched summary from a JSONL file */
export function extractEnrichedSummary(jsonlPath: string, cwd: string = ''): EnrichedSummary {
  const result: EnrichedSummary = {
    sessionDuration: '<1min',
    messageDensity: 'low',
    classifiedBash: [],
    errorsWithContext: [],
    fileChangeGroups: [],
    dedupedRequests: [],
    dedupedSummaries: [],
    decisions: [],
    toolStats: {},
    todoFinalState: null,
    gitActions: [],
  };

  let content: string;
  try {
    content = readFileSync(jsonlPath, 'utf-8');
  } catch {
    return result;
  }

  let startedAt: Date | null = null;
  let lastAt: Date | null = null;
  const userRequests: string[] = [];
  const assistantTexts: string[] = [];
  const filesCreated: string[] = [];
  const filesModified: Record<string, number> = {};
  const seenFilesCreated = new Set<string>();
  const todoSnapshots: string[] = [];
  const seenTodoHashes = new Set<string>();

  // Spike B fix: Sliding context window persists ACROSS messages (not just within one).
  // In real JSONL, assistant messages are split into separate lines:
  //   line 1: assistant -> tool_use(Bash, npm test)
  //   line 2: user -> tool_result
  //   line 3: assistant -> text("Error: ...")
  // The window tracks the last 3 tool calls globally.
  const contextWindow: ProcessingContext[] = [];

  function pushContext(toolName: string, input: Record<string, unknown>) {
    contextWindow.push({
      toolName,
      input,
      currentFile: String(input.file_path || ''),
      currentCommand: String(input.command || ''),
    });
    if (contextWindow.length > 3) contextWindow.shift();
  }

  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }

    const msgType = String(obj.type || '');
    const ts = String(obj.timestamp || '');
    if (ts) {
      const dt = new Date(ts);
      if (!isNaN(dt.getTime())) {
        if (!startedAt) startedAt = dt;
        lastAt = dt;
      }
    }

    if (msgType === 'user') {
      // Spike C: user content can be string OR array with text/tool_result items
      const msgContent = (obj.message as Record<string, unknown>)?.content;
      if (typeof msgContent === 'string') {
        if (msgContent && !isNoise(msgContent)) {
          userRequests.push(msgContent.trim());
        }
      } else if (Array.isArray(msgContent)) {
        for (const item of msgContent) {
          if (typeof item === 'object' && item !== null && (item as Record<string, unknown>).type === 'text') {
            const text = String((item as Record<string, unknown>).text || '');
            if (text && !isNoise(text)) {
              userRequests.push(text.trim());
            }
          }
          // tool_result items in user messages are NOT user requests — skip them
        }
      }
      continue;
    }

    if (msgType !== 'assistant') continue;

    const msgContent = (obj.message as Record<string, unknown>)?.content;
    if (!Array.isArray(msgContent)) {
      if (typeof msgContent === 'string' && msgContent) {
        assistantTexts.push(msgContent);
      }
      continue;
    }

    // Spike C: Each JSONL line may contain just ONE content type
    // (e.g., a line with only thinking, another with only tool_use, another with only text)
    for (const item of msgContent) {
      if (typeof item !== 'object' || item === null) continue;
      const dict = item as Record<string, unknown>;
      const itemType = String(dict.type || '');

      if (itemType === 'tool_use') {
        const name = String(dict.name || '');
        const input = (dict.input as Record<string, unknown>) || {};
        if (name) {
          result.toolStats[name] = (result.toolStats[name] || 0) + 1;
        }

        pushContext(name, input);

        if (name === 'Bash') {
          const cmd = String(input.command || '');
          if (cmd) {
            const category = classifyBashCategory(cmd);
            if (category === BashCategory.GIT) {
              result.gitActions.push(cmd);
            }
            result.classifiedBash.push({ cmd, category });
          }
        } else if (name === 'Write') {
          const fp = String(input.file_path || '');
          if (fp && !seenFilesCreated.has(fp)) {
            seenFilesCreated.add(fp);
            filesCreated.push(fp);
          }
        } else if (name === 'Edit') {
          const fp = String(input.file_path || '');
          if (fp) filesModified[fp] = (filesModified[fp] || 0) + 1;
        } else if (name === 'TodoWrite') {
          const todos = input.todos as Array<Record<string, string>> | undefined;
          if (todos && Array.isArray(todos)) {
            const snapshot = snapshotTodos(todos);
            const h = hashString(snapshot);
            if (!seenTodoHashes.has(h)) {
              seenTodoHashes.add(h);
              todoSnapshots.push(snapshot);
            }
          }
        }
      } else if (itemType === 'text') {
        const text = String(dict.text || '');
        if (text) {
          assistantTexts.push(text);
          // Spike B: Error binding uses the globally persistent contextWindow,
          // which holds the last 3 tool calls across ALL messages (not just current).
          // This handles the real pattern:
          //   assistant[tool_use Bash npm test] -> user[tool_result] -> assistant[text "Error..."]
          if (isErrorOrIssue(text)) {
            const ctx = contextWindow.length > 0 ? contextWindow[contextWindow.length - 1] : null;
            result.errorsWithContext.push({
              message: text,
              trigger: ctx?.toolName || '',
              command: ctx?.currentCommand || '',
              relatedFile: ctx?.currentFile || '',
            });
          }
        }
      } else if (itemType === 'thinking') {
        const thinking = String(dict.thinking || '');
        if (thinking) {
          extractDecisions(thinking, result as any);
        }
      }
    }
  }

  // Post-process
  if (startedAt && lastAt) {
    result.sessionDuration = formatDuration(startedAt, lastAt);
    result.messageDensity = computeDensity(userRequests.length, startedAt, lastAt);
  }

  result.dedupedRequests = dedupByJaccard(userRequests);
  result.dedupedSummaries = dedupByJaccard(assistantTexts.map(t => t.replace(/<[^>]+>/g, '').trim()).filter(Boolean));
  result.fileChangeGroups = groupFilesByDir(filesCreated, filesModified, cwd);
  result.decisions = result.decisions.slice(-10);
  result.gitActions = result.gitActions.slice(-15);
  result.classifiedBash = result.classifiedBash.slice(-30);
  result.errorsWithContext = result.errorsWithContext.slice(-10);
  result.todoFinalState = todoSnapshots.length > 0 ? todoSnapshots[todoSnapshots.length - 1] : null;

  return result;
}
