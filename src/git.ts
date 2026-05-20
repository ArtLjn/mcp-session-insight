import { execSync } from 'child_process';
import { readdirSync, statSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { PROJECTS_DIR, decodeProjectPath } from './utils.js';

export interface GitLogEntry {
  hash: string;
  message: string;
  author: string;
  date: string;
  files: string[];
}

export interface GitLogResult {
  project: string;
  projectName: string;
  commits: GitLogEntry[];
}

export interface GitLogOptions {
  since?: string;
  until?: string;
  project?: string;
  author?: string;
}

/** 发现所有 Claude Code 用过的项目路径 */
function discoverProjectPaths(): string[] {
  const paths: string[] = [];
  try {
    const entries = readdirSync(PROJECTS_DIR);
    for (const entry of entries) {
      try {
        const projDir = join(PROJECTS_DIR, entry);
        if (!statSync(projDir).isDirectory()) continue;
        const projectPath = decodeProjectPath(entry);
        paths.push(projectPath);
      } catch {
        continue;
      }
    }
  } catch {
    // projects dir may not exist
  }
  return paths;
}

/** 解析日期字符串，支持 YYYY-MM-DD 和相对日期 */
function resolveDate(input: string): string {
  // YYYY-MM-DD 格式
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }
  // 相对日期：today, yesterday 等
  try {
    const result = execSync(`date -j -f "%Y-%m-%d" "$(date -j +%Y-%m-%d)" +%Y-%m-%d 2>/dev/null || echo ""`, { encoding: 'utf-8' }).trim();
    if (input === 'yesterday') {
      return execSync(`date -j -v-1d +%Y-%m-%d`, { encoding: 'utf-8' }).trim();
    }
    if (input === 'today') {
      return execSync(`date -j +%Y-%m-%d`, { encoding: 'utf-8' }).trim();
    }
  } catch {
    // fallback
  }
  return input;
}

/** 获取今天的日期 YYYY-MM-DD */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 从单个项目收集 git log */
function collectProjectGitLog(projectPath: string, since: string, until: string, author?: string): GitLogEntry[] {
  const gitDir = join(projectPath, '.git');
  if (!existsSync(gitDir)) return [];

  try {
    const separator = '|||';
    const format = `${separator}%h${separator}%s${separator}%an${separator}%aI`;
    let cmd = `git log --all --after="${since}" --before="${until}" --pretty=format:"${format}" --name-only`;
    if (author) {
      cmd += ` --author="${author}"`;
    }

    const raw = execSync(cmd, {
      cwd: projectPath,
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();

    if (!raw) return [];

    const commits: GitLogEntry[] = [];
    // git log 用空行分隔每个 commit block
    const blocks = raw.split(/\n\n+/);

    for (const block of blocks) {
      const lines = block.split('\n');
      if (lines.length === 0) continue;

      // 第一行是格式化输出：|||hash|||message|||author|||date
      const header = lines[0];
      if (!header.startsWith(separator)) continue;

      const parts = header.split(separator).filter(Boolean);
      if (parts.length < 4) continue;

      const [hash, message, authorName, date] = parts;
      const files = lines.slice(1).filter(l => l.trim());

      commits.push({ hash, message, author: authorName, date, files });
    }

    return commits;
  } catch {
    return [];
  }
}

/** 收集跨项目 git log */
export function collectGitLogs(options: GitLogOptions = {}): GitLogResult[] {
  const since = options.since ? resolveDate(options.since) : today();
  // until 默认为明天的日期（包含今天所有提交）
  const until = options.until || (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const projectPaths = discoverProjectPaths();
  const results: GitLogResult[] = [];

  for (const projectPath of projectPaths) {
    // 按项目名或路径过滤
    if (options.project && !projectPath.toLowerCase().includes(options.project.toLowerCase())) {
      continue;
    }

    const commits = collectProjectGitLog(projectPath, since, until, options.author);
    if (commits.length > 0) {
      results.push({
        project: projectPath,
        projectName: basename(projectPath),
        commits,
      });
    }
  }

  return results;
}
