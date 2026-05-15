import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type {
  CallToolRequest,
  CallToolResult,
  ListToolsResult,
  ListResourcesResult,
  ReadResourceRequest,
  ReadResourceResult,
  ListPromptsResult,
  GetPromptRequest,
  GetPromptResult,
} from '@modelcontextprotocol/sdk/types.js';
import type { Session, WorkSummary } from './models.js';
import { listAllSessions, getSession, searchSessions, loadSessionMessages } from './store.js';
import { extractWorkSummary } from './extractor.js';
import { generateHandoffContext, similarity, cleanUserText } from './context.js';
import { shortPath } from './utils.js';

/** Resolve session by exact match first, then prefix match */
export function resolveSession(sessionId: string): Session | null {
  const sessions = listAllSessions();
  for (const s of sessions) {
    if (s.sessionId === sessionId) {
      s.messages = loadSessionMessages(s);
      return s;
    }
  }
  for (const s of sessions) {
    if (s.sessionId.startsWith(sessionId)) {
      s.messages = loadSessionMessages(s);
      return s;
    }
  }
  return null;
}

/** Wrap extractWorkSummary with session data */
export function getWorkSummary(session: Session): WorkSummary {
  return extractWorkSummary(session.jsonlPath);
}

/** Simple similarity-based dedup for requests */
export function dedupRequests(requests: string[]): string[] {
  const result: string[] = [];
  for (const req of requests) {
    const cleaned = cleanUserText(req);
    if (!cleaned) continue;
    const isDup = result.some(r => similarity(r, cleaned) >= 0.85);
    if (!isDup) result.push(cleaned);
  }
  return result;
}

/** Format session list as markdown */
export function formatSessionList(sessions: Session[], limit: number): string {
  const lines: string[] = [];
  lines.push(`# Sessions (${Math.min(sessions.length, limit)} shown)`);
  lines.push('');
  lines.push('| Session ID | Project | Started | Messages |');
  lines.push('|------------|---------|---------|----------|');
  for (const s of sessions.slice(0, limit)) {
    const project = shortPath(s.cwd);
    const started = s.startedAt.toISOString().slice(0, 16).replace('T', ' ');
    const msgCount = s._quickUserCount || 0;
    lines.push(`| \`${s.sessionId}\` | ${project} | ${started} | ${msgCount} |`);
  }
  return lines.join('\n');
}

/** Format single session detail as markdown */
export function formatSessionDetail(session: Session): string {
  const lines: string[] = [];
  lines.push(`# Session ${session.sessionId}`);
  lines.push('');
  lines.push(`- **Project**: ${shortPath(session.cwd)}`);
  lines.push(`- **Started**: ${session.startedAt.toISOString()}`);
  lines.push(`- **Kind**: ${session.kind}`);
  lines.push(`- **Entrypoint**: ${session.entrypoint || '-'}`);
  lines.push(`- **Branch**: ${session.gitBranch || '-'}`);
  lines.push(`- **Messages**: ${session.messages.length}`);
  if (session._quickFirstMsg) {
    lines.push(`- **First message**: ${cleanUserText(session._quickFirstMsg)}`);
  }
  return lines.join('\n');
}

/** Format search results as markdown */
export function formatSearchResults(sessions: Session[], keyword: string): string {
  const lines: string[] = [];
  lines.push(`# Search Results for "${keyword}"`);
  lines.push('');
  if (sessions.length === 0) {
    lines.push('No sessions found.');
    return lines.join('\n');
  }
  for (const s of sessions) {
    lines.push(`## ${s.sessionId}`);
    lines.push(`- Project: ${shortPath(s.cwd)}`);
    lines.push(`- Started: ${s.startedAt.toISOString()}`);
    if (s._quickFirstMsg) {
      lines.push(`- First message: ${cleanUserText(s._quickFirstMsg)}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/** Format file changes as markdown */
export function formatChanges(work: WorkSummary, cwd: string): string {
  const lines: string[] = [];
  lines.push('# File Changes');
  lines.push('');
  if (work.filesCreated.length > 0) {
    lines.push(`## Created (${work.filesCreated.length})`);
    for (const f of work.filesCreated) {
      lines.push(`- ${shortPath(f, cwd)}`);
    }
    lines.push('');
  }
  const modified = Object.keys(work.filesModified);
  if (modified.length > 0) {
    lines.push(`## Modified (${modified.length})`);
    for (const f of modified) {
      const count = work.filesModified[f];
      lines.push(`- ${shortPath(f, cwd)}${count > 1 ? ` (${count} times)` : ''}`);
    }
    lines.push('');
  }
  if (work.filesCreated.length === 0 && modified.length === 0) {
    lines.push('No file changes recorded.');
  }
  return lines.join('\n');
}

/** Format deduplicated requests as markdown */
export function formatRequests(requests: string[]): string {
  const lines: string[] = [];
  lines.push('# User Requests');
  lines.push('');
  const deduped = dedupRequests(requests);
  if (deduped.length === 0) {
    lines.push('No user requests found.');
    return lines.join('\n');
  }
  deduped.forEach((req, i) => {
    lines.push(`${i + 1}. ${req}`);
  });
  return lines.join('\n');
}

/** Format todo snapshots as markdown */
export function formatTodos(todoSnapshots: string[]): string {
  const lines: string[] = [];
  lines.push('# Todo Snapshots');
  lines.push('');
  if (todoSnapshots.length === 0) {
    lines.push('No todo snapshots found.');
    return lines.join('\n');
  }
  for (let i = 0; i < todoSnapshots.length; i++) {
    lines.push(`## Snapshot ${i + 1}`);
    lines.push('```');
    lines.push(todoSnapshots[i]);
    lines.push('```');
    lines.push('');
  }
  return lines.join('\n');
}

/** Format errors as markdown */
export function formatErrors(errors: string[]): string {
  const lines: string[] = [];
  lines.push('# Errors / Issues');
  lines.push('');
  if (errors.length === 0) {
    lines.push('No errors found.');
    return lines.join('\n');
  }
  errors.forEach((err, i) => {
    lines.push(`## ${i + 1}`);
    lines.push('```');
    lines.push(err);
    lines.push('```');
    lines.push('');
  });
  return lines.join('\n');
}

/** Format decisions as markdown */
export function formatDecisions(decisions: string[]): string {
  const lines: string[] = [];
  lines.push('# Decisions');
  lines.push('');
  if (decisions.length === 0) {
    lines.push('No decisions found.');
    return lines.join('\n');
  }
  decisions.forEach((d, i) => {
    lines.push(`${i + 1}. ${cleanUserText(d)}`);
  });
  return lines.join('\n');
}

/** Format conversation as markdown */
export function formatConversation(
  session: Session,
  roleFilter: 'user' | 'assistant' | 'all',
  limit: number,
): string {
  const lines: string[] = [];
  lines.push(`# Conversation — ${session.sessionId}`);
  lines.push('');

  let msgs = session.messages;
  if (roleFilter !== 'all') {
    msgs = msgs.filter(m => m.msgType === roleFilter);
  }
  msgs = msgs.slice(-limit);

  if (msgs.length === 0) {
    lines.push('No messages found.');
    return lines.join('\n');
  }

  for (const m of msgs) {
    const role = m.msgType === 'user' ? 'User' : 'Assistant';
    const ts = m.timestamp.slice(0, 16).replace('T', ' ');
    lines.push(`## ${role} — ${ts}`);
    lines.push('');
    lines.push(m.text || '*(empty)*');
    lines.push('');
  }

  return lines.join('\n');
}

/** Create the MCP server instance */
export function createServer(): Server {
  const server = new Server(
    { name: 'mcp-session-insight', version: '0.1.0' },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async (): Promise<ListToolsResult> => {
    return {
      tools: [
        {
          name: 'list_sessions',
          description: 'List all sessions, optionally filtered by project',
          inputSchema: {
            type: 'object',
            properties: {
              project: { type: 'string', description: 'Project path filter' },
              limit: { type: 'number', description: 'Max results', default: 20 },
            },
          },
        },
        {
          name: 'show_session',
          description: 'Show detailed info for a session',
          inputSchema: {
            type: 'object',
            properties: {
              session_id: { type: 'string', description: 'Session ID (supports prefix match)' },
            },
            required: ['session_id'],
          },
        },
        {
          name: 'search_sessions',
          description: 'Search sessions by keyword',
          inputSchema: {
            type: 'object',
            properties: {
              keyword: { type: 'string', description: 'Search keyword' },
            },
            required: ['keyword'],
          },
        },
        {
          name: 'get_session_summary',
          description: 'Get handoff context summary for a session',
          inputSchema: {
            type: 'object',
            properties: {
              session_id: { type: 'string', description: 'Session ID (supports prefix match)' },
            },
            required: ['session_id'],
          },
        },
        {
          name: 'get_session_changes',
          description: 'Get file changes for a session',
          inputSchema: {
            type: 'object',
            properties: {
              session_id: { type: 'string', description: 'Session ID (supports prefix match)' },
            },
            required: ['session_id'],
          },
        },
        {
          name: 'get_session_requests',
          description: 'Get deduplicated user requests for a session',
          inputSchema: {
            type: 'object',
            properties: {
              session_id: { type: 'string', description: 'Session ID (supports prefix match)' },
            },
            required: ['session_id'],
          },
        },
        {
          name: 'get_session_todos',
          description: 'Get todo snapshots for a session',
          inputSchema: {
            type: 'object',
            properties: {
              session_id: { type: 'string', description: 'Session ID (supports prefix match)' },
            },
            required: ['session_id'],
          },
        },
        {
          name: 'get_session_errors',
          description: 'Get errors/issues for a session',
          inputSchema: {
            type: 'object',
            properties: {
              session_id: { type: 'string', description: 'Session ID (supports prefix match)' },
            },
            required: ['session_id'],
          },
        },
        {
          name: 'get_session_decisions',
          description: 'Get decisions for a session',
          inputSchema: {
            type: 'object',
            properties: {
              session_id: { type: 'string', description: 'Session ID (supports prefix match)' },
            },
            required: ['session_id'],
          },
        },
        {
          name: 'get_session_conversation',
          description: 'Get conversation messages for a session',
          inputSchema: {
            type: 'object',
            properties: {
              session_id: { type: 'string', description: 'Session ID (supports prefix match)' },
              role: {
                type: 'string',
                enum: ['user', 'assistant', 'all'],
                description: 'Message role filter',
                default: 'all',
              },
              limit: { type: 'number', description: 'Max messages', default: 50 },
            },
            required: ['session_id'],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest): Promise<CallToolResult> => {
    const args = (request.params.arguments || {}) as Record<string, unknown>;
    const name = request.params.name;

    function notFound(sessionId: string): CallToolResult {
      return {
        content: [{ type: 'text', text: `Session not found: ${sessionId}` }],
        isError: true,
      };
    }

    switch (name) {
      case 'list_sessions': {
        const project = String(args.project || '');
        const limit = Number(args.limit || 20);
        const sessions = listAllSessions(project);
        return { content: [{ type: 'text', text: formatSessionList(sessions, limit) }] };
      }

      case 'show_session': {
        const sessionId = String(args.session_id || '');
        const session = resolveSession(sessionId);
        if (!session) return notFound(sessionId);
        return { content: [{ type: 'text', text: formatSessionDetail(session) }] };
      }

      case 'search_sessions': {
        const keyword = String(args.keyword || '');
        const sessions = searchSessions(keyword);
        return { content: [{ type: 'text', text: formatSearchResults(sessions, keyword) }] };
      }

      case 'get_session_summary': {
        const sessionId = String(args.session_id || '');
        const session = resolveSession(sessionId);
        if (!session) return notFound(sessionId);
        const work = getWorkSummary(session);
        const ctx = generateHandoffContext(session, work);
        return { content: [{ type: 'text', text: ctx }] };
      }

      case 'get_session_changes': {
        const sessionId = String(args.session_id || '');
        const session = resolveSession(sessionId);
        if (!session) return notFound(sessionId);
        const work = getWorkSummary(session);
        return { content: [{ type: 'text', text: formatChanges(work, session.cwd) }] };
      }

      case 'get_session_requests': {
        const sessionId = String(args.session_id || '');
        const session = resolveSession(sessionId);
        if (!session) return notFound(sessionId);
        const work = getWorkSummary(session);
        return { content: [{ type: 'text', text: formatRequests(work.userRequests) }] };
      }

      case 'get_session_todos': {
        const sessionId = String(args.session_id || '');
        const session = resolveSession(sessionId);
        if (!session) return notFound(sessionId);
        const work = getWorkSummary(session);
        return { content: [{ type: 'text', text: formatTodos(work.todoSnapshots) }] };
      }

      case 'get_session_errors': {
        const sessionId = String(args.session_id || '');
        const session = resolveSession(sessionId);
        if (!session) return notFound(sessionId);
        const work = getWorkSummary(session);
        return { content: [{ type: 'text', text: formatErrors(work.errorsOrIssues) }] };
      }

      case 'get_session_decisions': {
        const sessionId = String(args.session_id || '');
        const session = resolveSession(sessionId);
        if (!session) return notFound(sessionId);
        const work = getWorkSummary(session);
        return { content: [{ type: 'text', text: formatDecisions(work.decisions) }] };
      }

      case 'get_session_conversation': {
        const sessionId = String(args.session_id || '');
        const session = resolveSession(sessionId);
        if (!session) return notFound(sessionId);
        const role = String(args.role || 'all') as 'user' | 'assistant' | 'all';
        const limit = Number(args.limit || 50);
        return { content: [{ type: 'text', text: formatConversation(session, role, limit) }] };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async (): Promise<ListResourcesResult> => {
    return {
      resources: [
        {
          uri: 'session-insight://sessions',
          name: 'All Sessions',
          description: 'JSON array of all sessions',
          mimeType: 'application/json',
        },
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest): Promise<ReadResourceResult> => {
    const uri = request.params.uri;

    if (uri === 'session-insight://sessions') {
      const sessions = listAllSessions();
      const data = sessions.map(s => ({
        sessionId: s.sessionId,
        cwd: s.cwd,
        startedAt: s.startedAt.toISOString(),
        kind: s.kind,
        entrypoint: s.entrypoint,
        gitBranch: s.gitBranch,
        userCount: s._quickUserCount,
        assistantCount: s._quickAssistantCount,
      }));
      return {
        contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }],
      };
    }

    const match = uri.match(/^session-insight:\/\/session\/([^/]+)\/work-summary$/);
    if (match) {
      const sessionId = match[1];
      const session = resolveSession(sessionId);
      if (!session) {
        return {
          contents: [{ uri, mimeType: 'application/json', text: JSON.stringify({ error: 'Session not found' }) }],
        };
      }
      const work = getWorkSummary(session);
      return {
        contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(work, null, 2) }],
      };
    }

    return {
      contents: [{ uri, mimeType: 'application/json', text: JSON.stringify({ error: 'Unknown resource' }) }],
    };
  });

  server.setRequestHandler(ListPromptsRequestSchema, async (): Promise<ListPromptsResult> => {
    return {
      prompts: [
        {
          name: 'session_handoff',
          description: 'Generate a handoff context prompt for a session',
          arguments: [
            {
              name: 'session_id',
              description: 'Session ID (supports prefix match)',
              required: true,
            },
          ],
        },
      ],
    };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request: GetPromptRequest): Promise<GetPromptResult> => {
    const name = request.params.name;
    const args = (request.params.arguments || {}) as Record<string, string>;

    if (name === 'session_handoff') {
      const sessionId = args.session_id || '';
      const session = resolveSession(sessionId);
      if (!session) {
        return {
          description: 'Session handoff context',
          messages: [
            {
              role: 'assistant',
              content: { type: 'text', text: `Session not found: ${sessionId}` },
            },
          ],
        };
      }
      const work = getWorkSummary(session);
      const ctx = generateHandoffContext(session, work);
      return {
        description: 'Session handoff context',
        messages: [
          {
            role: 'assistant',
            content: { type: 'text', text: ctx },
          },
        ],
      };
    }

    return {
      description: 'Unknown prompt',
      messages: [
        {
          role: 'assistant',
          content: { type: 'text', text: `Unknown prompt: ${name}` },
        },
      ],
    };
  });

  return server;
}

/** Start the MCP server with stdio transport */
export async function startServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
