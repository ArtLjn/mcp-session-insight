import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  extractWorkSummary,
  isNoise,
  isErrorOrIssue,
  classifyBashCommand,
  snapshotTodos,
  extractDecisions,
  flushAssistantTexts,
} from '../src/extractor.js';
import type { WorkSummary } from '../src/models.js';

function makeEmptyResult(): WorkSummary {
  return {
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
}

describe('extractWorkSummary', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'extractor-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeJsonl(name: string, lines: unknown[]): string {
    const fp = join(tmpDir, name);
    const text = lines.map(l => JSON.stringify(l)).join('\n');
    writeFileSync(fp, text, 'utf-8');
    return fp;
  }

  it('extracts file changes from Write/Edit/Read tool_use', () => {
    const fp = writeJsonl('files.jsonl', [
      {
        type: 'assistant',
        timestamp: '2024-01-01T00:00:00Z',
        sessionId: 's1',
        message: {
          content: [
            { type: 'tool_use', name: 'Write', input: { file_path: '/a/b.ts' } },
            { type: 'tool_use', name: 'Edit', input: { file_path: '/a/b.ts' } },
            { type: 'tool_use', name: 'Read', input: { file_path: '/a/c.ts' } },
            { type: 'tool_use', name: 'Glob', input: { file_path: '/a/*.ts' } },
          ],
        },
      },
    ]);
    const result = extractWorkSummary(fp);
    expect(result.filesCreated).toContain('/a/b.ts');
    expect(result.filesModified).toEqual({ '/a/b.ts': 1 });
    expect(result.filesRead).toContain('/a/c.ts');
    expect(result.filesRead).toContain('/a/*.ts');
    expect(result.toolStats).toEqual({ Write: 1, Edit: 1, Read: 1, Glob: 1 });
  });

  it('extracts user requests and filters noise', () => {
    const fp = writeJsonl('user.jsonl', [
      { type: 'user', timestamp: '2024-01-01T00:00:00Z', sessionId: 's1', message: { content: 'hello world' } },
      { type: 'user', timestamp: '2024-01-01T00:01:00Z', sessionId: 's1', message: { content: 'ok' } },
      { type: 'user', timestamp: '2024-01-01T00:02:00Z', sessionId: 's1', message: { content: '好的' } },
      { type: 'user', timestamp: '2024-01-01T00:03:00Z', sessionId: 's1', message: { content: 'fix the bug' } },
    ]);
    const result = extractWorkSummary(fp);
    expect(result.userRequests).toEqual(['hello world', 'fix the bug']);
  });

  it('extracts todo snapshots from TodoWrite tool_use', () => {
    const fp = writeJsonl('todos.jsonl', [
      {
        type: 'assistant',
        timestamp: '2024-01-01T00:00:00Z',
        sessionId: 's1',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'TodoWrite',
              input: {
                todos: [
                  { status: 'pending', content: 'Task A' },
                  { status: 'completed', content: 'Task B' },
                ],
              },
            },
          ],
        },
      },
    ]);
    const result = extractWorkSummary(fp);
    expect(result.todoSnapshots).toHaveLength(1);
    expect(result.todoSnapshots[0]).toBe('[pending] Task A\n[completed] Task B');
  });

  it('detects errors in assistant text', () => {
    const fp = writeJsonl('errors.jsonl', [
      {
        type: 'assistant',
        timestamp: '2024-01-01T00:00:00Z',
        sessionId: 's1',
        message: {
          content: [
            { type: 'text', text: 'Traceback (most recent call last):\n  File "a.py", line 1\nSyntaxError' },
          ],
        },
      },
    ]);
    const result = extractWorkSummary(fp);
    expect(result.errorsOrIssues.length).toBeGreaterThan(0);
    expect(result.errorsOrIssues[0]).toContain('Traceback');
  });

  it('detects decisions from thinking blocks', () => {
    const fp = writeJsonl('thinking.jsonl', [
      {
        type: 'assistant',
        timestamp: '2024-01-01T00:00:00Z',
        sessionId: 's1',
        message: {
          content: [
            { type: 'thinking', thinking: 'After analysis, I decided to use the factory pattern.\nThis is the best approach.' },
          ],
        },
      },
    ]);
    const result = extractWorkSummary(fp);
    expect(result.decisions.length).toBeGreaterThan(0);
    expect(result.decisions[0]).toContain('decided to use');
  });

  it('classifies bash commands as git vs regular', () => {
    const fp = writeJsonl('bash.jsonl', [
      {
        type: 'assistant',
        timestamp: '2024-01-01T00:00:00Z',
        sessionId: 's1',
        message: {
          content: [
            { type: 'tool_use', name: 'Bash', input: { command: 'git commit -m "feat: add x"' } },
            { type: 'tool_use', name: 'Bash', input: { command: 'ls -la' } },
          ],
        },
      },
    ]);
    const result = extractWorkSummary(fp);
    expect(result.gitActions).toContain('git commit -m "feat: add x"');
    expect(result.bashCommands).toContain('ls -la');
  });

  it('deduplicates filesCreated', () => {
    const fp = writeJsonl('dedup.jsonl', [
      {
        type: 'assistant',
        timestamp: '2024-01-01T00:00:00Z',
        sessionId: 's1',
        message: {
          content: [
            { type: 'tool_use', name: 'Write', input: { file_path: '/a/x.ts' } },
            { type: 'tool_use', name: 'Write', input: { file_path: '/a/x.ts' } },
          ],
        },
      },
    ]);
    const result = extractWorkSummary(fp);
    expect(result.filesCreated).toEqual(['/a/x.ts']);
  });

  it('limits array sizes to last N', () => {
    const lines: unknown[] = [];
    for (let i = 0; i < 60; i++) {
      lines.push({
        type: 'user',
        timestamp: `2024-01-01T00:${String(i).padStart(2, '0')}:00Z`,
        sessionId: 's1',
        message: { content: `request ${i}` },
      });
    }
    for (let i = 0; i < 40; i++) {
      lines.push({
        type: 'assistant',
        timestamp: `2024-01-01T01:${String(i).padStart(2, '0')}:00Z`,
        sessionId: 's1',
        message: {
          content: [
            { type: 'tool_use', name: 'Bash', input: { command: `cmd ${i}` } },
          ],
        },
      });
    }
    for (let i = 0; i < 20; i++) {
      lines.push({
        type: 'assistant',
        timestamp: `2024-01-01T02:${String(i).padStart(2, '0')}:00Z`,
        sessionId: 's1',
        message: {
          content: [
            { type: 'text', text: `summary ${i}` },
          ],
        },
      });
    }
    const fp = writeJsonl('limits.jsonl', lines);
    const result = extractWorkSummary(fp);
    expect(result.userRequests).toHaveLength(50);
    expect(result.userRequests[0]).toBe('request 10');
    expect(result.bashCommands).toHaveLength(30);
    expect(result.bashCommands[0]).toBe('cmd 10');
    expect(result.assistantSummaries).toHaveLength(15);
    expect(result.assistantSummaries[0]).toBe('summary 5');
  });
});

describe('isNoise', () => {
  it('returns true for short acknowledgments', () => {
    expect(isNoise('ok')).toBe(true);
    expect(isNoise('好的')).toBe(true);
    expect(isNoise('没问题')).toBe(true);
    expect(isNoise('可以')).toBe(true);
    expect(isNoise('嗯')).toBe(true);
    expect(isNoise('行')).toBe(true);
  });

  it('returns true for IDE events and skill expansions', () => {
    expect(isNoise('<ide_opened_file>/a.ts</ide_opened_file>')).toBe(true);
    expect(isNoise('<skill_expanded>some-skill</skill_expanded>')).toBe(true);
  });

  it('returns true for empty/whitespace', () => {
    expect(isNoise('')).toBe(true);
    expect(isNoise('   ')).toBe(true);
  });

  it('returns false for meaningful text', () => {
    expect(isNoise('fix the bug')).toBe(false);
    expect(isNoise('please review')).toBe(false);
  });
});

describe('isErrorOrIssue', () => {
  it('detects Python traceback', () => {
    expect(isErrorOrIssue('Traceback (most recent call last):')).toBe(true);
    expect(isErrorOrIssue('SyntaxError: invalid syntax')).toBe(true);
    expect(isErrorOrIssue('ImportError: No module named x')).toBe(true);
  });

  it('detects generic errors', () => {
    expect(isErrorOrIssue('Error: something went wrong')).toBe(true);
    expect(isErrorOrIssue('fatal: not a git repository')).toBe(true);
    expect(isErrorOrIssue('FAILED')).toBe(true);
  });

  it('returns false for normal text', () => {
    expect(isErrorOrIssue('hello world')).toBe(false);
    expect(isErrorOrIssue('success')).toBe(false);
  });
});

describe('classifyBashCommand', () => {
  it('classifies git commands', () => {
    const r = makeEmptyResult();
    classifyBashCommand('git commit -m "x"', r);
    classifyBashCommand('git push origin main', r);
    expect(r.gitActions).toEqual(['git commit -m "x"', 'git push origin main']);
    expect(r.bashCommands).toHaveLength(0);
  });

  it('classifies regular commands', () => {
    const r = makeEmptyResult();
    classifyBashCommand('ls -la', r);
    classifyBashCommand('npm test', r);
    expect(r.bashCommands).toEqual(['ls -la', 'npm test']);
    expect(r.gitActions).toHaveLength(0);
  });
});

describe('snapshotTodos', () => {
  it('formats todo list', () => {
    const todos = [
      { status: 'pending', content: 'A' },
      { status: 'completed', content: 'B' },
    ];
    expect(snapshotTodos(todos)).toBe('[pending] A\n[completed] B');
  });

  it('handles empty list', () => {
    expect(snapshotTodos([])).toBe('');
  });
});

describe('extractDecisions', () => {
  it('extracts English decisions', () => {
    const r = makeEmptyResult();
    extractDecisions('I decided to use TypeScript.\nThen I will use Vite.', r);
    expect(r.decisions.length).toBe(2);
  });

  it('extracts Chinese decisions', () => {
    const r = makeEmptyResult();
    extractDecisions('决定采用工厂模式\n最终选择使用 React', r);
    expect(r.decisions.length).toBe(2);
  });

  it('ignores non-decision lines', () => {
    const r = makeEmptyResult();
    extractDecisions('hello world\nnothing here', r);
    expect(r.decisions).toHaveLength(0);
  });
});

describe('flushAssistantTexts', () => {
  it('merges texts and adds to summaries', () => {
    const r = makeEmptyResult();
    flushAssistantTexts(['hello', 'world'], r);
    expect(r.assistantSummaries).toEqual(['hello\nworld']);
  });

  it('detects errors in merged text', () => {
    const r = makeEmptyResult();
    flushAssistantTexts(['Traceback (most recent call last):'], r);
    expect(r.assistantSummaries).toHaveLength(1);
    expect(r.errorsOrIssues).toHaveLength(1);
  });

  it('ignores empty texts', () => {
    const r = makeEmptyResult();
    flushAssistantTexts([], r);
    expect(r.assistantSummaries).toHaveLength(0);
  });
});
