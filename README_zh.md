<img src="banner.png" width="100%" alt="mcp-session-insight banner" />

**简体中文** | [English](README.md)

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
| `get_session_summary` | 返回结构化 EnrichedSummary JSON，由 LLM 合成摘要 |
| `get_session_changes` | 获取文件变更（新建/修改/读取） |
| `get_session_requests` | 获取去重后的用户请求 |
| `get_session_todos` | 获取任务进度快照 |
| `get_session_errors` | 获取错误和问题记录 |
| `get_session_decisions` | 获取关键决策（从 thinking 提取） |
| `get_session_conversation` | 获取对话记录（支持角色过滤） |
| `get_git_logs` | 跨项目收集 git commit 记录（日期范围、项目过滤、作者过滤） |

## 资源

- `session-insight://sessions` — 所有会话的 JSON 列表
- `session-insight://session/{id}/work-summary` — JSON 工作摘要

## 提示词

- `session_handoff` — 生成会话交接上下文，无缝衔接下次会话

## 工作原理

本 MCP Server 直接读取 Claude Code 存储在 `~/.claude/projects/` 下的 JSONL 文件，提取结构化洞察信息（文件变更、用户请求、关键决策、错误记录、任务进度），通过 MCP 协议暴露给 AI 客户端。

### EnrichedSummary (v0.3.0+)

`get_session_summary` 不再返回预排版的 Markdown 模板，而是返回结构化 JSON 数据，包含语义分类、上下文关联的错误、按目录分组的文件变更。调用方 LLM 基于这些数据合成简洁摘要 —— 零额外 API 成本。

**核心特性：**
- 跨项目 git log 收集（支持日期范围、项目过滤、作者过滤）
- Bash 命令语义分类（build/test/deploy/debug/network/run/git/explore）
- 滑动窗口 error 上下文绑定（将错误与触发工具关联）
- Jaccard trigram 用户请求去重（阈值 0.4，准确率 93%）
- 文件变更按目录分组
- Session 时长和消息密度统计

### 无状态设计

不引入数据库，不持久化，每次请求直接读取 JSONL 文件。

## 系统要求

- Node.js >= 18
- Claude Code 会话存储在 `~/.claude/projects/`（默认路径）

## 许可证

MIT
