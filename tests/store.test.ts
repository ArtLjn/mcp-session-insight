import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'path';
import { homedir } from 'os';
import {
  mkdirSync,
  rmSync,
  copyFileSync,
  existsSync,
} from 'fs';
import {
  loadSessionFromJsonl,
  loadSessionMessages,
  listAllSessions,
  getSession,
  searchSessions,
} from '../src/store.js';
import { MessageType } from '../src/models.js';

const TEST_PROJ_NAME = '-testproj';
const TEST_PROJ_DIR = join(homedir(), '.claude', 'projects', TEST_PROJ_NAME);
const FIXTURE_SRC = join(__dirname, 'fixtures', 'sample.jsonl');
const FIXTURE_DST = join(TEST_PROJ_DIR, 'abc123.jsonl');

describe('store', () => {
  beforeAll(() => {
    if (existsSync(TEST_PROJ_DIR)) {
      rmSync(TEST_PROJ_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_PROJ_DIR, { recursive: true });
    copyFileSync(FIXTURE_SRC, FIXTURE_DST);
  });

  afterAll(() => {
    if (existsSync(TEST_PROJ_DIR)) {
      rmSync(TEST_PROJ_DIR, { recursive: true, force: true });
    }
  });

  describe('loadSessionFromJsonl', () => {
    it('returns correct metadata from fixture', () => {
      const session = loadSessionFromJsonl(FIXTURE_DST, '/testproj');
      expect(session).not.toBeNull();
      expect(session!.sessionId).toBe('abc123');
      expect(session!.cwd).toBe('/Users/ljn/proj');
      expect(session!._quickUserCount).toBe(2);
      expect(session!._quickAssistantCount).toBe(2);
      expect(session!.startedAt).toBeInstanceOf(Date);
    });

    it('returns null for non-existent file', () => {
      const session = loadSessionFromJsonl('/nonexistent/path.jsonl');
      expect(session).toBeNull();
    });
  });

  describe('loadSessionMessages', () => {
    it('returns 4 messages with correct text', () => {
      const session = loadSessionFromJsonl(FIXTURE_DST, '/testproj')!;
      const messages = loadSessionMessages(session);
      expect(messages).toHaveLength(4);

      expect(messages[0].msgType).toBe(MessageType.USER);
      expect(messages[0].text).toBe('hello world');

      expect(messages[1].msgType).toBe(MessageType.ASSISTANT);
      expect(messages[1].text).toBe('Hi there');

      expect(messages[2].msgType).toBe(MessageType.USER);
      expect(messages[2].text).toBe('fix the bug');

      expect(messages[3].msgType).toBe(MessageType.ASSISTANT);
      expect(messages[3].text).toBe('I see the issue');
    });
  });

  describe('listAllSessions', () => {
    it('finds the test session', () => {
      const sessions = listAllSessions();
      const found = sessions.find(s => s.sessionId === 'abc123');
      expect(found).toBeDefined();
    });

    it('filters by project keyword', () => {
      const sessions = listAllSessions('testproj');
      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions.every(s => s.cwd.includes('testproj') || s.jsonlPath.includes('testproj'))).toBe(true);
    });

    it('returns empty array for non-matching filter', () => {
      const sessions = listAllSessions('nonexistent-project-xyz');
      expect(sessions).toHaveLength(0);
    });
  });

  describe('getSession', () => {
    it('returns session with messages loaded', () => {
      const session = getSession('abc123');
      expect(session).not.toBeNull();
      expect(session!.sessionId).toBe('abc123');
      expect(session!.messages.length).toBeGreaterThan(0);
    });

    it('returns null for unknown session', () => {
      const session = getSession('unknown-session-id-xyz');
      expect(session).toBeNull();
    });
  });

  describe('searchSessions', () => {
    it('finds session by keyword in user message', () => {
      const results = searchSessions('bug');
      expect(results.length).toBeGreaterThan(0);
      const found = results.find(r => r.sessionId === 'abc123');
      expect(found).toBeDefined();
    });

    it('finds session by sessionId', () => {
      const results = searchSessions('abc123');
      expect(results.length).toBeGreaterThan(0);
      const found = results.find(r => r.sessionId === 'abc123');
      expect(found).toBeDefined();
    });

    it('returns all sessions when keyword is empty', () => {
      const results = searchSessions('');
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
