import { describe, it, expect } from 'vitest';
import {
  formatDate,
  cleanUserText,
  compareSessions,
} from '../src/context.js';
import type { Session, EnrichedSummary } from '../src/models.js';

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

function makeEnrichedSummary(overrides: Partial<EnrichedSummary> = {}): EnrichedSummary {
  return {
    sessionDuration: '30min',
    messageDensity: 'medium',
    classifiedBash: [],
    errorsWithContext: [],
    fileChangeGroups: [],
    dedupedRequests: [],
    dedupedSummaries: [],
    decisions: [],
    toolStats: {},
    todoFinalState: null,
    gitActions: [],
    ...overrides,
  };
}

describe('formatDate', () => {
  it('formats date as MM-DD HH:mm', () => {
    const d = new Date('2024-06-15T10:30:00Z');
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
    expect(cleanUserText(long).length).toBeLessThanOrEqual(203);
  });
});

describe('compareSessions', () => {
  it('produces markdown with both session IDs', () => {
    const sessionA = makeSession({ sessionId: 'sess-A', cwd: '/Users/ljn/proj-a' });
    const sessionB = makeSession({ sessionId: 'sess-B', cwd: '/Users/ljn/proj-b' });
    const workA = makeEnrichedSummary();
    const workB = makeEnrichedSummary();
    const cmp = compareSessions(sessionA, sessionB, workA, workB);
    expect(cmp).toContain('sess-A');
    expect(cmp).toContain('sess-B');
    expect(cmp).toContain('Session 对比');
  });

  it('shows common and unique files', () => {
    const sessionA = makeSession({ sessionId: 'sess-A' });
    const sessionB = makeSession({ sessionId: 'sess-B' });
    const workA = makeEnrichedSummary({
      fileChangeGroups: [
        { directory: 'src/', created: ['common.ts', 'only-a.ts'], modified: [] },
      ],
    });
    const workB = makeEnrichedSummary({
      fileChangeGroups: [
        { directory: 'src/', created: ['common.ts', 'only-b.ts'], modified: [] },
      ],
    });
    const cmp = compareSessions(sessionA, sessionB, workA, workB);
    expect(cmp).toContain('共同文件');
    expect(cmp).toContain('common.ts');
    expect(cmp).toContain('仅在 Session A');
    expect(cmp).toContain('only-a.ts');
    expect(cmp).toContain('仅在 Session B');
    expect(cmp).toContain('only-b.ts');
  });

  it('shows user requests from both sessions', () => {
    const sessionA = makeSession({ sessionId: 'sess-A' });
    const sessionB = makeSession({ sessionId: 'sess-B' });
    const workA = makeEnrichedSummary({ dedupedRequests: ['request A1'] });
    const workB = makeEnrichedSummary({ dedupedRequests: ['request B1'] });
    const cmp = compareSessions(sessionA, sessionB, workA, workB);
    expect(cmp).toContain('request A1');
    expect(cmp).toContain('request B1');
  });
});
