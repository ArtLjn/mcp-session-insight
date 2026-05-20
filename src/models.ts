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

/** Bash command semantic category */
export enum BashCategory {
  BUILD = 'build',
  TEST = 'test',
  DEPLOY = 'deploy',
  DEBUG = 'debug',
  NETWORK = 'network',
  RUN = 'run',
  GIT = 'git',
  EXPLORE = 'explore',
  OTHER = 'other',
}

/** Bash command with semantic classification */
export interface ClassifiedBash {
  cmd: string;
  category: BashCategory;
}

/** Error with surrounding context */
export interface ErrorWithContext {
  message: string;
  trigger: string;
  command: string;
  relatedFile: string;
}

/** File changes grouped by directory */
export interface FileChangeGroup {
  directory: string;
  created: string[];
  modified: Array<{ file: string; count: number }>;
}

/** Enriched summary replacing WorkSummary */
export interface EnrichedSummary {
  sessionDuration: string;
  messageDensity: string;
  classifiedBash: ClassifiedBash[];
  errorsWithContext: ErrorWithContext[];
  fileChangeGroups: FileChangeGroup[];
  dedupedRequests: string[];
  dedupedSummaries: string[];
  decisions: string[];
  toolStats: Record<string, number>;
  todoFinalState: string | null;
  gitActions: string[];
}

/** Sliding context window for tracking tool calls */
export interface ProcessingContext {
  toolName: string;
  input: Record<string, unknown>;
  currentFile: string;
  currentCommand: string;
}
