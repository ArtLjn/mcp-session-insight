import { shortPath } from './utils.js';
import type { Session, EnrichedSummary } from './models.js';

/** Format date as "MM-DD HH:mm" */
export function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Strip tags, collapse newlines, truncate */
export function cleanUserText(text: string): string {
  text = text.replace(/<[^>]+>/g, '').trim();
  text = text.replace(/\n+/g, ' ');
  if (text.length > 200) text = text.slice(0, 197) + '...';
  return text;
}

/** Generate Markdown comparison between two sessions */
export function compareSessions(
  sessionA: Session,
  sessionB: Session,
  workA: EnrichedSummary,
  workB: EnrichedSummary,
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
  lines.push(`| 需求数 | ${workA.dedupedRequests.length} | ${workB.dedupedRequests.length} |`);
  lines.push(`| 文件分组 | ${workA.fileChangeGroups.length} | ${workB.fileChangeGroups.length} |`);
  lines.push(`| Bash 命令 | ${workA.classifiedBash.length} | ${workB.classifiedBash.length} |`);
  lines.push(`| Git 操作 | ${workA.gitActions.length} | ${workB.gitActions.length} |`);
  lines.push(`| 错误 | ${workA.errorsWithContext.length} | ${workB.errorsWithContext.length} |`);
  lines.push('');

  // Collect all files from both sessions
  const filesA = new Set<string>();
  const filesB = new Set<string>();
  for (const g of workA.fileChangeGroups) {
    for (const f of g.created) filesA.add(`${g.directory}${f}`);
    for (const m of g.modified) filesA.add(`${g.directory}${m.file}`);
  }
  for (const g of workB.fileChangeGroups) {
    for (const f of g.created) filesB.add(`${g.directory}${f}`);
    for (const m of g.modified) filesB.add(`${g.directory}${m.file}`);
  }

  const commonFiles = [...filesA].filter(f => filesB.has(f));
  const onlyA = [...filesA].filter(f => !filesB.has(f));
  const onlyB = [...filesB].filter(f => !filesA.has(f));

  if (commonFiles.length > 0) {
    lines.push('### 共同文件');
    lines.push('');
    commonFiles.forEach(f => lines.push(`- ${f}`));
    lines.push('');
  }

  if (onlyA.length > 0) {
    lines.push('### 仅在 Session A');
    lines.push('');
    onlyA.forEach(f => lines.push(`- ${f}`));
    lines.push('');
  }

  if (onlyB.length > 0) {
    lines.push('### 仅在 Session B');
    lines.push('');
    onlyB.forEach(f => lines.push(`- ${f}`));
    lines.push('');
  }

  // User requests from both
  if (workA.dedupedRequests.length > 0 || workB.dedupedRequests.length > 0) {
    lines.push('### 用户需求对比');
    lines.push('');
    if (workA.dedupedRequests.length > 0) {
      lines.push(`**Session A (${workA.dedupedRequests.length}):**`);
      workA.dedupedRequests.forEach((r, i) => lines.push(`  ${i + 1}. ${r}`));
      lines.push('');
    }
    if (workB.dedupedRequests.length > 0) {
      lines.push(`**Session B (${workB.dedupedRequests.length}):**`);
      workB.dedupedRequests.forEach((r, i) => lines.push(`  ${i + 1}. ${r}`));
      lines.push('');
    }
  }

  return lines.join('\n');
}
