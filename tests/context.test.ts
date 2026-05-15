import { describe, it, expect } from 'vitest';
import {
  formatDate,
  cleanUserText,
  similarity,
  generateHandoffContext,
  compareSessions,
} from '../src/context.js';
import type { Session, WorkSummary } from '../src/models.js';

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    sessionId: 'sess-abc123',
    pid: 12345,
    cwd: '/Users/ljn/proj',
    startedAt: new Date('2024-06-15T10:30:00Z'),
    kind: 'interactive' as const,
    entrypoint: 'cli',
    messages: [],
    jsonlPath: '/tmp/sess.jsonl',
    gitBranch: 'main',
    ...overrides,
  };
}

function makeWorkSummary(overrides: Partial<WorkSummary> = {}): WorkSummary {
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
    ...overrides,
  };
}

describe('formatDate', () => {
  it('formats date as MM-DD HH:mm', () => {
    const d = new Date('2024-06-15T10:30:00Z');
    // Use UTC hours to avoid timezone flakiness in CI
    const pad = (n: number) => String(n).padStart(2, '0');
    const expected = `06-15 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    expect(formatDate(d)).toBe(expected);
  });
});

describe('cleanUserText', () => {
  it('strips tags and collapses newlines', () => {
    expect(cleanUserText('<tag>hello\n\nworld</tag>')).toBe('hello world');
  });

  it('truncates long text', () => {
    const long = 'a'.repeat(300);
    expect(cleanUserText(long).length).toBeLessThanOrEqual(203); // 200 + '...'
  });
});

describe('similarity', () => {
  it('returns 1 for identical strings', () => {
    expect(similarity('hello', 'hello')).toBe(1);
  });

  it('returns 0 for completely different strings', () => {
    expect(similarity('abc', 'xyz')).toBe(0);
  });

  it('returns value between 0 and 1 for partial match', () => {
    const s = similarity('hello world', 'hello there');
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
  });
});

describe('generateHandoffContext', () => {
  it('includes project name and user requests', () => {
    const session = makeSession();
    const work = makeWorkSummary({
      userRequests: ['fix login bug', 'add dark mode'],
    });
    const ctx = generateHandoffContext(session, work);
    expect(ctx).toContain('proj');
    expect(ctx).toContain('fix login bug');
    expect(ctx).toContain('add dark mode');
  });

  it('includes file changes', () => {
    const session = makeSession();
    const work = makeWorkSummary({
      filesCreated: ['/Users/ljn/proj/src/new.ts'],
      filesModified: { '/Users/ljn/proj/src/old.ts': 2 },
    });
    const ctx = generateHandoffContext(session, work);
    expect(ctx).toContain('src/new.ts');
    expect(ctx).toContain('src/old.ts');
    expect(ctx).toContain('(2 次)');
  });

  it('includes todo snapshots', () => {
    const session = makeSession();
    const work = makeWorkSummary({
      todoSnapshots: ['[pending] Task A\n[completed] Task B'],
    });
    const ctx = generateHandoffContext(session, work);
    expect(ctx).toContain('Todo 快照');
    expect(ctx).toContain('[pending] Task A');
  });

  it('includes decisions', () => {
    const session = makeSession();
    const work = makeWorkSummary({
      decisions: ['Decided to use React', 'Chose TypeScript'],
    });
    const ctx = generateHandoffContext(session, work);
    expect(ctx).toContain('关键决策');
    expect(ctx).toContain('Decided to use React');
  });

  it('deduplicates similar user requests', () => {
    const session = makeSession();
    const work = makeWorkSummary({
      userRequests: ['fix the login bug please', 'fix the login bug please now'],
    });
    const ctx = generateHandoffContext(session, work);
    // Only one should appear due to high similarity
    const matches = ctx.match(/fix the login bug please/g);
    expect(matches?.length).toBe(1);
  });
});

describe('compareSessions', () => {
  it('produces markdown with both session IDs', () => {
    const sessionA = makeSession({ sessionId: 'sess-A', cwd: '/Users/ljn/proj-a' });
    const sessionB = makeSession({ sessionId: 'sess-B', cwd: '/Users/ljn/proj-b' });
    const workA = makeWorkSummary();
    const workB = makeWorkSummary();
    const cmp = compareSessions(sessionA, sessionB, workA, workB);
    expect(cmp).toContain('sess-A');
    expect(cmp).toContain('sess-B');
    expect(cmp).toContain('Session 对比');
  });

  it('shows common and unique files', () => {
    const sessionA = makeSession({ sessionId: 'sess-A' });
    const sessionB = makeSession({ sessionId: 'sess-B' });
    const workA = makeWorkSummary({
      filesCreated: ['/Users/ljn/proj/src/common.ts', '/Users/ljn/proj/src/only-a.ts'],
    });
    const workB = makeWorkSummary({
      filesCreated: ['/Users/ljn/proj/src/common.ts', '/Users/ljn/proj/src/only-b.ts'],
    });
    const cmp = compareSessions(sessionA, sessionB, workA, workB);
    expect(cmp).toContain('共同文件');
    expect(cmp).toContain('src/common.ts');
    expect(cmp).toContain('仅在 Session A');
    expect(cmp).toContain('src/only-a.ts');
    expect(cmp).toContain('仅在 Session B');
    expect(cmp).toContain('src/only-b.ts');
  });

  it('shows user requests from both sessions', () => {
    const sessionA = makeSession({ sessionId: 'sess-A' });
    const sessionB = makeSession({ sessionId: 'sess-B' });
    const workA = makeWorkSummary({ userRequests: ['request A1'] });
    const workB = makeWorkSummary({ userRequests: ['request B1'] });
    const cmp = compareSessions(sessionA, sessionB, workA, workB);
    expect(cmp).toContain('request A1');
    expect(cmp).toContain('request B1');
  });
});
