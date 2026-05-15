import { describe, it, expect } from 'vitest';
import { createServer, resolveSession, dedupRequests, formatSessionList } from '../src/server.js';
import type { Session } from '../src/models.js';

describe('server', () => {
  it('createServer returns a valid Server instance', () => {
    const server = createServer();
    expect(server).toBeDefined();
    expect(typeof server.connect).toBe('function');
    expect(typeof server.setRequestHandler).toBe('function');
  });

  it('resolveSession returns null for unknown session', () => {
    const result = resolveSession('nonexistent-session-id-xyz');
    expect(result).toBeNull();
  });

  it('dedupRequests removes similar items', () => {
    const requests = [
      'fix the login bug please',
      'fix the login bug please now',
      'add dark mode',
      'add dark mode support',
    ];
    const result = dedupRequests(requests);
    expect(result.length).toBeLessThan(requests.length);
  });

  it('formatSessionList produces markdown table', () => {
    const session: Session = {
      sessionId: 'abc123',
      pid: 12345,
      cwd: '/Users/ljn/proj',
      startedAt: new Date('2024-06-15T10:30:00Z'),
      kind: 'interactive' as const,
      entrypoint: 'cli',
      messages: [],
      jsonlPath: '/tmp/abc123.jsonl',
      _quickUserCount: 3,
      _quickAssistantCount: 2,
      _quickFirstMsg: 'hello',
      _lastAt: new Date('2024-06-15T10:30:00Z'),
    };
    const md = formatSessionList([session], 10);
    expect(md).toContain('abc123');
    expect(md).toContain('| Session ID |');
  });
});
