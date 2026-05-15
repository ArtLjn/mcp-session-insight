import { shortPath, truncate } from './utils.js';
import type { Session, WorkSummary } from './models.js';

/** Format date as "MM-DD HH:mm" */
export function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Strip tags, collapse newlines, truncate */
export function cleanUserText(text: string): string {
  text = text.replace(/<[^>]+>/g, '').trim();
  text = text.replace(/\n+/g, ' ');
  return truncate(text, 200);
}

/** Simple prefix-based similarity for dedup (0..1) */
export function similarity(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (s1 === s2) return 1;
  const minLen = Math.min(s1.length, s2.length);
  if (minLen === 0) return 0;
  let common = 0;
  for (let i = 0; i < minLen; i++) {
    if (s1[i] === s2[i]) common++;
    else break;
  }
  return common / Math.max(s1.length, s2.length);
}

/** Deduplicate strings by prefix similarity, keep first occurrence */
function dedupSimilar(items: string[], threshold = 0.85): string[] {
  const result: string[] = [];
  for (const item of items) {
    const cleaned = cleanUserText(item);
    if (!cleaned) continue;
    const isDup = result.some(r => similarity(r, cleaned) >= threshold);
    if (!isDup) result.push(cleaned);
  }
  return result;
}

/** Generate Markdown handoff context for a session */
export function generateHandoffContext(session: Session, work: WorkSummary): string {
  const lines: string[] = [];

  // Header
  lines.push('╭───────────────────────────── Session 上下文交接 ─────────────────────────────╮');
  lines.push(`│ 项目: ${shortPath(session.cwd)}`);
  lines.push(`│ Session: ${session.sessionId}`);
  lines.push(`│ 时间: ${formatDate(session.startedAt)}`);
  if (session.gitBranch) {
    lines.push(`│ 分支: ${session.gitBranch}`);
  }
  lines.push('╰──────────────────────────────────────────────────────────────────────────────╯');
  lines.push('');

  // User requests
  const dedupedRequests = dedupSimilar(work.userRequests);
  if (dedupedRequests.length > 0) {
    lines.push('## 用户需求记录');
    lines.push('');
    dedupedRequests.forEach((req, i) => {
      lines.push(`  ${i + 1}. ${req}`);
    });
    lines.push('');
  }

  // File changes
  const modifiedFiles = Object.keys(work.filesModified);
  const createdFiles = work.filesCreated;
  if (modifiedFiles.length > 0 || createdFiles.length > 0) {
    lines.push('## 文件变更');
    lines.push('');
    if (createdFiles.length > 0) {
      lines.push(`- 新建 (${createdFiles.length}):`);
      createdFiles.forEach(f => lines.push(`  - ${shortPath(f, session.cwd)}`));
    }
    if (modifiedFiles.length > 0) {
      lines.push(`- 修改 (${modifiedFiles.length}):`);
      modifiedFiles.forEach(f => {
        const count = work.filesModified[f];
        lines.push(`  - ${shortPath(f, session.cwd)}${count > 1 ? ` (${count} 次)` : ''}`);
      });
    }
    lines.push('');
  }

  // Workload stats
  lines.push('## 工作量统计');
  lines.push('');
  lines.push(`| 指标 | 数值 |`);
  lines.push(`|------|------|`);
  lines.push(`| 用户消息 | ${work.userRequests.length} |`);
  lines.push(`| 助手回复 | ${work.assistantSummaries.length} |`);
  lines.push(`| 文件新建 | ${createdFiles.length} |`);
  lines.push(`| 文件修改 | ${modifiedFiles.length} |`);
  lines.push(`| Bash 命令 | ${work.bashCommands.length} |`);
  lines.push(`| Git 操作 | ${work.gitActions.length} |`);
  lines.push(`| 错误/问题 | ${work.errorsOrIssues.length} |`);
  lines.push('');

  // Todo snapshots
  if (work.todoSnapshots.length > 0) {
    lines.push('## Todo 快照 (最终状态)');
    lines.push('');
    const last = work.todoSnapshots[work.todoSnapshots.length - 1];
    lines.push('```');
    lines.push(last);
    lines.push('```');
    lines.push('');
  }

  // Assistant summaries
  const summaries = work.assistantSummaries.slice(-8);
  if (summaries.length > 0) {
    lines.push('## 助手摘要 (最近 8 条)');
    lines.push('');
    summaries.forEach((s, i) => {
      lines.push(`${i + 1}. ${cleanUserText(s)}`);
    });
    lines.push('');
  }

  // Decisions
  const decisions = work.decisions.slice(-8);
  if (decisions.length > 0) {
    lines.push('## 关键决策 (最近 8 条)');
    lines.push('');
    decisions.forEach((d, i) => {
      lines.push(`${i + 1}. ${cleanUserText(d)}`);
    });
    lines.push('');
  }

  // Errors
  const lastError = work.errorsOrIssues.slice(-1)[0];
  if (lastError) {
    lines.push('## 最近错误/问题');
    lines.push('');
    lines.push('```');
    lines.push(lastError);
    lines.push('```');
    lines.push('');
  }

  // Git actions
  const gitActions = work.gitActions.slice(-10);
  if (gitActions.length > 0) {
    lines.push('## Git 操作 (最近 10 条)');
    lines.push('');
    gitActions.forEach(cmd => {
      lines.push(`- \`${cmd}\``);
    });
    lines.push('');
  }

  // Bash commands
  const bashCommands = work.bashCommands.slice(-15);
  if (bashCommands.length > 0) {
    lines.push('## Bash 命令 (最近 15 条)');
    lines.push('');
    bashCommands.forEach(cmd => {
      lines.push(`- \`${cmd}\``);
    });
    lines.push('');
  }

  // Read-only files
  if (work.filesRead.length > 0) {
    const uniqueReads = [...new Set(work.filesRead.map(f => shortPath(f, session.cwd)))];
    lines.push('## 参考文件 (只读)');
    lines.push('');
    uniqueReads.forEach(f => lines.push(`- ${f}`));
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push(`*Session ${session.sessionId} | ${work.userRequests.length} 条需求 | ${formatDate(session.startedAt)}*`);

  return lines.join('\n');
}

/** Generate Markdown comparison between two sessions */
export function compareSessions(
  sessionA: Session,
  sessionB: Session,
  workA: WorkSummary,
  workB: WorkSummary,
): string {
  const lines: string[] = [];

  lines.push('## Session 对比');
  lines.push('');

  // Overview table
  lines.push('| 指标 | Session A | Session B |');
  lines.push('|------|-----------|-----------|');
  lines.push(`| ID | ${sessionA.sessionId} | ${sessionB.sessionId} |`);
  lines.push(`| 项目 | ${shortPath(sessionA.cwd)} | ${shortPath(sessionB.cwd)} |`);
  lines.push(`| 时间 | ${formatDate(sessionA.startedAt)} | ${formatDate(sessionB.startedAt)} |`);
  lines.push(`| 分支 | ${sessionA.gitBranch || '-'} | ${sessionB.gitBranch || '-'} |`);
  lines.push(`| 需求数 | ${workA.userRequests.length} | ${workB.userRequests.length} |`);
  lines.push(`| 文件新建 | ${workA.filesCreated.length} | ${workB.filesCreated.length} |`);
  lines.push(`| 文件修改 | ${Object.keys(workA.filesModified).length} | ${Object.keys(workB.filesModified).length} |`);
  lines.push(`| Bash 命令 | ${workA.bashCommands.length} | ${workB.bashCommands.length} |`);
  lines.push(`| Git 操作 | ${workA.gitActions.length} | ${workB.gitActions.length} |`);
  lines.push(`| 错误/问题 | ${workA.errorsOrIssues.length} | ${workB.errorsOrIssues.length} |`);
  lines.push('');

  // Common files
  const filesA = new Set([
    ...workA.filesCreated,
    ...Object.keys(workA.filesModified),
  ]);
  const filesB = new Set([
    ...workB.filesCreated,
    ...Object.keys(workB.filesModified),
  ]);
  const commonFiles = [...filesA].filter(f => filesB.has(f));
  const onlyA = [...filesA].filter(f => !filesB.has(f));
  const onlyB = [...filesB].filter(f => !filesA.has(f));

  if (commonFiles.length > 0) {
    lines.push('### 共同文件');
    lines.push('');
    commonFiles.forEach(f => lines.push(`- ${shortPath(f, sessionA.cwd)}`));
    lines.push('');
  }

  if (onlyA.length > 0) {
    lines.push('### 仅在 Session A');
    lines.push('');
    onlyA.forEach(f => lines.push(`- ${shortPath(f, sessionA.cwd)}`));
    lines.push('');
  }

  if (onlyB.length > 0) {
    lines.push('### 仅在 Session B');
    lines.push('');
    onlyB.forEach(f => lines.push(`- ${shortPath(f, sessionB.cwd)}`));
    lines.push('');
  }

  // User requests from both
  const requestsA = dedupSimilar(workA.userRequests);
  const requestsB = dedupSimilar(workB.userRequests);
  if (requestsA.length > 0 || requestsB.length > 0) {
    lines.push('### 用户需求对比');
    lines.push('');
    if (requestsA.length > 0) {
      lines.push(`**Session A (${requestsA.length}):**`);
      requestsA.forEach((r, i) => lines.push(`  ${i + 1}. ${r}`));
      lines.push('');
    }
    if (requestsB.length > 0) {
      lines.push(`**Session B (${requestsB.length}):**`);
      requestsB.forEach((r, i) => lines.push(`  ${i + 1}. ${r}`));
      lines.push('');
    }
  }

  return lines.join('\n');
}
