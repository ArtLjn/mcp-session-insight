<img src="banner.png" width="100%" alt="mcp-session-insight banner" />

简体中文 | **English**

MCP Server for Claude Code Session Insight — read, analyze, and handoff sessions.

## Installation

```bash
npm install -g @morningljn/mcp-session-insight
```

Or use via npx (no install):

```bash
npx @morningljn/mcp-session-insight
```

## Configuration

Add to your Claude Code MCP settings:

```bash
claude mcp add session-insight -- npx @morningljn/mcp-session-insight
```

Or manually add to `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "session-insight": {
      "command": "npx",
      "args": ["@morningljn/mcp-session-insight"]
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `list_sessions` | List all sessions with optional project filter and limit |
| `show_session` | Show session details (supports prefix matching) |
| `search_sessions` | Search sessions by keyword in content or ID |
| `get_session_summary` | Returns structured EnrichedSummary JSON for LLM synthesis |
| `get_session_changes` | Get file changes (created / modified / read) |
| `get_session_requests` | Get deduplicated user requests |
| `get_session_todos` | Get todo progress snapshots |
| `get_session_errors` | Get errors and issues encountered |
| `get_session_decisions` | Get key decisions from thinking blocks |
| `get_session_conversation` | Get conversation history with role filter |
| `get_git_logs` | Collect git commit logs across projects (date range, project, author filters) |

## Resources

- `session-insight://sessions` — JSON list of all sessions
- `session-insight://session/{id}/work-summary` — JSON work summary

## Prompts

- `session_handoff` — Generate handoff context for seamless session continuation

## How It Works

This MCP Server reads Claude Code's session JSONL files from `~/.claude/projects/`, extracts structured insights (file changes, user requests, decisions, errors, todos), and exposes them via the Model Context Protocol.

### EnrichedSummary (v0.3.0+)

Instead of returning a pre-formatted Markdown template, `get_session_summary` returns structured JSON data with semantic classification, contextualized errors, and directory-grouped file changes. The calling LLM synthesizes a concise summary from this data — zero extra API cost.

**Key features:**
- Cross-project git log collection with date range, project, and author filters
- Bash command semantic classification (build/test/deploy/debug/network/run/git/explore)
- Error context binding via sliding window (associates errors with triggering tools)
- Jaccard trigram deduplication for user requests (93% accuracy at 0.4 threshold)
- File changes grouped by directory
- Session duration and message density metrics

### Stateless Design

No database, no persistence. Reads JSONL directly on each request.

## Requirements

- Node.js >= 18
- Claude Code sessions in `~/.claude/projects/` (default location)

## License

MIT
