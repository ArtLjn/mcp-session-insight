# mcp-session-insight

[简体中文](#简体中文) | English

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

This MCP Server reads Claude Code's session JSONL files from `~/.claude/projects/`, extracts structured insights (file changes, user requests, decisions, errors, todos), and exposes them via the Model Context Protocol.

**Stateless design:** No database, no persistence. Reads JSONL directly on each request.

## Requirements

- Node.js >= 18
- Claude Code sessions in `~/.claude/projects/` (default location)

## License

MIT

---

## 简体中文

MCP Server 用于 Claude Code Session 洞察 — 读取、分析和交接会话。

## 安装

```bash
npm install -g @morningljn/mcp-session-insight
```

或者使用 npx（无需安装）：

```bash
npx @morningljn/mcp-session-insight
```

## 配置

使用 Claude Code CLI 一键注册：

```bash
claude mcp add session-insight -- npx @morningljn/mcp-session-insight
```

或手动添加到 `~/.claude/mcp.json`：

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

## 工具列表

| 工具 | 说明 |
|------|------|
| `list_sessions` | 列出所有会话，支持按项目过滤和分页 |
| `show_session` | 查看会话详情（支持前缀匹配） |
| `search_sessions` | 按关键字搜索会话 |
| `get_session_summary` | 生成交接上下文摘要 |
| `get_session_changes` | 获取文件变更（新建/修改/读取） |
| `get_session_requests` | 获取去重后的用户请求 |
| `get_session_todos` | 获取任务进度快照 |
| `get_session_errors` | 获取错误和问题记录 |
| `get_session_decisions` | 获取关键决策（从 thinking 提取） |
| `get_session_conversation` | 获取对话记录（支持角色过滤） |

## 工作原理

本 MCP Server 直接读取 Claude Code 存储在 `~/.claude/projects/` 下的 JSONL 文件，提取结构化洞察信息（文件变更、用户请求、关键决策、错误记录、任务进度），通过 MCP 协议暴露给 AI 客户端。

**无状态设计：** 不引入数据库，不持久化，每次请求直接读取 JSONL 文件。

## 许可证

MIT
