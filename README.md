# mcp-session-insight

MCP Server for Claude Code Session Insight — read, analyze, and handoff sessions.

## Installation

```bash
npm install -g mcp-session-insight
```

Or use via npx (no install):

```bash
npx mcp-session-insight
```

## Configuration

Add to your Claude Code MCP settings (`~/.claude/mcp.json`):

```json
{
  "mcpServers": {
    "session-insight": {
      "command": "npx",
      "args": ["mcp-session-insight"]
    }
  }
}
```

Or use the Claude Code CLI:

```bash
claude mcp add session-insight -- npx mcp-session-insight
```

## Tools

| Tool | Description |
|------|-------------|
| `list_sessions` | List all sessions with optional project filter and limit |
| `show_session` | Show session details (supports prefix matching) |
| `search_sessions` | Search sessions by keyword in content or ID |
| `get_session_summary` | Generate handoff context for session continuation |
| `get_session_changes` | Get file changes (created / modified / read) |
| `get_session_requests` | Get deduplicated user requests |
| `get_session_todos` | Get todo progress snapshots |
| `get_session_errors` | Get errors and issues encountered |
| `get_session_decisions` | Get key decisions from thinking blocks |
| `get_session_conversation` | Get conversation history with role filter |

## Resources

- `session-insight://sessions` — JSON list of all sessions
- `session-insight://session/{id}/work-summary` — JSON work summary

## Prompts

- `session_handoff` — Generate handoff context for seamless session continuation

## How It Works

This MCP Server reads Claude Code's session JSONL files from `~/.claude/projects/`,
extracts structured insights (file changes, user requests, decisions, errors, todos),
and exposes them via the Model Context Protocol.

**Stateless design:** No database, no persistence. Reads JSONL directly on each request.

## Requirements

- Node.js >= 18
- Claude Code sessions in `~/.claude/projects/` (default location)

## License

MIT
