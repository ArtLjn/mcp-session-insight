<img src="banner.png" width="100%" alt="mcp-session-insight" />

<div align="center">

# MCP Session Insight

**AI-Native Session Observability for Claude Code**

**简体中文** | [English](README.md)

![npm](https://img.shields.io/npm/v/@morningljn/mcp-session-insight?color=blue&label=npm)
![license](https://img.shields.io/badge/license-MIT-blue)
![node](https://img.shields.io/badge/node-%3E%3D18-green)
![MCP](https://img.shields.io/badge/MCP-Protocol-purple)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Vitest](https://img.shields.io/badge/Vitest-Test-green)

</div>

---

## 为什么需要 session-insight？

Claude Code 的每次会话都积累了丰富的上下文——文件变更、用户请求、关键决策、错误记录、git 历史——但会话结束后这些信息就消失了。`CLAUDE.md` 存储的是静态规则，无法回答"我今天做了什么"或"上次会话哪里出了问题"。

session-insight 为你的 AI 助手提供**对历史会话的只读洞察能力**：

- **会话分析** — 从 JSONL 提取结构化洞察：文件变更、决策、错误、工具使用、任务进度
- **EnrichedSummary** — 返回结构化 JSON 而非 Markdown 模板，调用方 LLM 合成简洁摘要，零额外 API 成本
- **跨项目 git log** — 按日期范围、项目、作者收集所有项目的 commit 历史
- **语义分类** — Bash 命令按 9 个类别分类（build/test/deploy/debug/network/run/git/explore/other）
- **会话交接** — 生成结构化上下文，无缝衔接下次会话

## 快速开始

```bash
# 安装
npm install -g @morningljn/mcp-session-insight

# 一键配置
claude mcp add session-insight -- npx @morningljn/mcp-session-insight
```

重启 AI 助手，即可查询所有历史会话。

### 手动配置

添加到 `~/.claude/mcp.json`：

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
| `show_session` | 查看会话元信息（支持 session ID 前缀匹配） |
| `search_sessions` | 按关键字搜索会话 |
| `get_session_summary` | 返回 EnrichedSummary JSON，由 LLM 合成摘要 |
| `get_session_changes` | 获取文件变更（新建/修改/读取） |
| `get_session_requests` | 获取去重后的用户请求 |
| `get_session_todos` | 获取任务进度快照 |
| `get_session_errors` | 获取带上下文的错误和问题记录 |
| `get_session_decisions` | 获取 thinking 中的关键决策 |
| `get_session_conversation` | 获取对话记录（支持角色过滤） |
| `get_git_logs` | 跨项目收集 git commit 记录 |

### `get_session_summary`（EnrichedSummary）

返回结构化 JSON 而非格式化文本。调用方 LLM 读取数据后合成简洁摘要——零额外 API 成本。

```json
{
  "sessionDuration": "116min",
  "messageDensity": "low",
  "classifiedBash": [{ "cmd": "npm test", "category": "test" }],
  "errorsWithContext": [{ "message": "...", "trigger": "Bash", "relatedFile": "src/server.ts" }],
  "fileChangeGroups": [{ "directory": "src", "created": ["git.ts"], "modified": [] }],
  "dedupedRequests": ["重构 summary 为结构化 JSON"],
  "decisions": ["使用 Jaccard trigram 做去重"],
  "toolStats": { "Bash": 93, "Read": 39, "Edit": 38 },
  "gitActions": ["git commit -m \"feat: ...\"", "git push origin main"]
}
```

### `get_git_logs`

跨项目收集 git commit 历史：

```json
[
  {
    "project": "/Users/user/project",
    "projectName": "my-app",
    "commits": [
      { "hash": "a1b2c3d", "message": "feat: add auth", "author": "user", "date": "2026-05-20T10:00:00+08:00", "files": ["src/auth.ts"] }
    ]
  }
]
```

## 架构

```
┌───────────────────┐   stdio    ┌──────────────────┐   read     ┌──────────────────────────┐
│   MCP Client      │◄─────────►│ session-insight  │◄──────────►│ ~/.claude/projects/      │
│ (Claude / Codex)  │   JSON    │     server       │            │                          │
└───────────────────┘           └───────┬──────────┘            │  ┌─project-a/            │
                                        │                       │  │  ├─session-1.jsonl     │
                                 ┌──────┴──────┐                │  │  └─session-2.jsonl     │
                                 │             │                │  └─project-b/            │
                                 │  Extractor  │   Git Log      │     └─session-3.jsonl     │
                                 │  (summary,  │   Collector    │                          │
                                 │   classify, │   (git log     └──────────────────────────┘
                                 │   dedup,    │    per project)
                                 │   errors)   │
                                 └─────────────┘
```

**核心设计决策：**

- **无状态** — 不引入数据库，不持久化，每次请求直接读取 JSONL 文件
- **零依赖** — 仅依赖 `@modelcontextprotocol/sdk`，所有处理均为纯计算
- **LLM 友好输出** — 结构化 JSON，由调用方 LLM 合成自然语言摘要

## 开发

```bash
npm install
npm test        # vitest 运行测试
npm run build   # 编译 TypeScript
npm start       # 启动 MCP server
```

## 许可证

MIT
