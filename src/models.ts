/** Claude Code JSONL message types */
export enum MessageType {
  USER = 'user',
  ASSISTANT = 'assistant',
  QUEUE_OPERATION = 'queue-operation',
}

/** Session kind from Claude Code metadata */
export enum SessionKind {
  INTERACTIVE = 'interactive',
  PRINT = 'print',
}

/** A single message in a session */
export interface SessionMessage {
  uuid: string;
  timestamp: string;
  sessionId: string;
  msgType: MessageType;
  text: string;
  cwd: string;
  gitBranch: string;
  parentUuid: string;
  raw: Record<string, unknown>;
}

/** Session metadata (lightweight, no messages loaded) */
export interface Session {
  sessionId: string;
  pid: number;
  cwd: string;
  startedAt: Date;
  kind: SessionKind;
  entrypoint: string;
  messages: SessionMessage[];
  jsonlPath: string;
  gitBranch?: string;
  // Quick-scan cached fields
  _quickUserCount?: number;
  _quickAssistantCount?: number;
  _quickFirstMsg?: string;
  _lastAt?: Date;
}

/** Work summary extracted from a session's JSONL */
export interface WorkSummary {
  filesModified: Record<string, number>;
  filesCreated: string[];
  filesRead: string[];
  toolStats: Record<string, number>;
  userRequests: string[];
  assistantSummaries: string[];
  bashCommands: string[];
  todoSnapshots: string[];
  errorsOrIssues: string[];
  decisions: string[];
  gitActions: string[];
}
