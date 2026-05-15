import { readFileSync, readdirSync, statSync, mkdirSync, rmSync, copyFileSync } from 'fs';
import { join } from 'path';
import { MessageType, SessionKind, type Session, type SessionMessage } from './models.js';
import { PROJECTS_DIR, decodeProjectPath, extractTextFromMessage, parseTimestamp } from './utils.js';

function parseIsoToDate(ts: string): Date | null {
  try {
    return new Date(ts);
  } catch {
    return null;
  }
}

/** Fast metadata scan — does NOT load messages */
export function loadSessionFromJsonl(jsonlPath: string, projectPath: string = ''): Session | null {
  try {
    const sessionId = jsonlPath.split('/').pop()!.replace('.jsonl', '');
    let startedAt: Date | null = null;
    let lastAt: Date | null = null;
    let cwd = projectPath;
    let entrypoint = '';
    let firstUserMsg = '';
    let userCount = 0;
    let assistantCount = 0;

    const content = readFileSync(jsonlPath, 'utf-8');
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
        const dt = parseIsoToDate(ts);
        if (dt) {
          if (!startedAt) startedAt = dt;
          lastAt = dt;
        }
      }

      if (msgType === 'user') {
        userCount++;
        const jsonlCwd = String(obj.cwd || '');
        if (jsonlCwd) cwd = jsonlCwd;
        if (!entrypoint) entrypoint = String(obj.entrypoint || '');
        if (!firstUserMsg) {
          const text = extractTextFromMessage((obj.message as Record<string, unknown>) || {}).trim();
          if (text && !text.startsWith('<ide_opened_file>')) {
            firstUserMsg = text;
          }
        }
      } else if (msgType === 'assistant') {
        assistantCount++;
      }
    }

    if (!startedAt) return null;

    return {
      sessionId,
      pid: 0,
      cwd,
      startedAt,
      kind: SessionKind.INTERACTIVE,
      entrypoint,
      messages: [],
      jsonlPath,
      _quickUserCount: userCount,
      _quickAssistantCount: assistantCount,
      _quickFirstMsg: firstUserMsg,
      _lastAt: lastAt || startedAt,
    };
  } catch {
    return null;
  }
}

/** Load full message history from JSONL */
export function loadSessionMessages(session: Session): SessionMessage[] {
  const messages: SessionMessage[] = [];
  try {
    const content = readFileSync(session.jsonlPath, 'utf-8');
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      let obj: Record<string, unknown>;
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }

      const msgType = String(obj.type || '');
      if (!['user', 'assistant'].includes(msgType)) continue;

      const msgContent = (obj.message as Record<string, unknown>) || {};
      const text = extractTextFromMessage(msgContent);

      messages.push({
        uuid: String(obj.uuid || ''),
        timestamp: parseTimestamp(String(obj.timestamp || '')),
        sessionId: String(obj.sessionId || ''),
        msgType: msgType as MessageType,
        text,
        cwd: String(obj.cwd || ''),
        gitBranch: String(obj.gitBranch || ''),
        parentUuid: String(obj.parentUuid || ''),
        raw: obj,
      });
    }
  } catch {
    // ignore read errors
  }
  return messages;
}

/** List all sessions from ~/.claude/projects/ */
export function listAllSessions(projectFilter: string = ''): Session[] {
  const sessions: Session[] = [];
  try {
    const entries = readdirSync(PROJECTS_DIR);
    for (const entry of entries) {
      const projDir = join(PROJECTS_DIR, entry);
      try {
        if (!statSync(projDir).isDirectory()) continue;
      } catch {
        continue;
      }
      const projectPath = decodeProjectPath(entry);
      if (projectFilter && !projectPath.includes(projectFilter)) continue;

      const jsonlFiles = readdirSync(projDir).filter(f => f.endsWith('.jsonl'));
      for (const jsonlFile of jsonlFiles) {
        const session = loadSessionFromJsonl(join(projDir, jsonlFile), projectPath);
        if (session) sessions.push(session);
      }
    }
  } catch {
    // projects dir may not exist
  }
  sessions.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  return sessions;
}

/** Get session by ID (exact match) with messages loaded */
export function getSession(sessionId: string): Session | null {
  const sessions = listAllSessions();
  for (const s of sessions) {
    if (s.sessionId === sessionId) {
      s.messages = loadSessionMessages(s);
      return s;
    }
  }
  return null;
}

/** Search sessions by keyword in session_id or user messages */
export function searchSessions(keyword: string): Session[] {
  const sessions = listAllSessions();
  if (!keyword) return sessions;

  const results: Session[] = [];
  const lower = keyword.toLowerCase();
  for (const session of sessions) {
    if (session.sessionId.toLowerCase().includes(lower)) {
      session.messages = loadSessionMessages(session);
      results.push(session);
      continue;
    }
    session.messages = loadSessionMessages(session);
    const userMsgs = session.messages.filter(m => m.msgType === MessageType.USER && m.text);
    for (const msg of userMsgs) {
      if (msg.text.toLowerCase().includes(lower)) {
        results.push(session);
        break;
      }
    }
  }
  return results;
}
