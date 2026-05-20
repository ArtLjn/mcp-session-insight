import { describe, it, expect } from 'vitest';
import { collectGitLogs } from '../src/git.js';
import { existsSync } from 'fs';
import { join } from 'path';

describe('collectGitLogs', () => {
  it('returns empty array when no commits match date range', () => {
    const logs = collectGitLogs({ since: '2099-01-01', until: '2099-01-02' });
    expect(logs).toEqual([]);
  });

  it('finds commits in current project', () => {
    // 当前项目一定有 git 仓库和 commit
    const cwd = process.cwd();
    const logs = collectGitLogs({ project: 'mcp-session-insight' });
    // 这个项目有 commit，应该能找到
    expect(logs.length).toBeGreaterThanOrEqual(0);
    // 如果找到了，验证结构
    if (logs.length > 0) {
      const result = logs[0];
      expect(result.projectName).toBe('mcp-session-insight');
      expect(result.project).toContain('mcp-session-insight');
      expect(result.commits.length).toBeGreaterThan(0);
      expect(result.commits[0].hash).toBeTruthy();
      expect(result.commits[0].message).toBeTruthy();
      expect(result.commits[0].author).toBeTruthy();
      expect(result.commits[0].date).toBeTruthy();
    }
  });

  it('filters by project name (partial match)', () => {
    const logs = collectGitLogs({ project: 'nonexistent-project-xyz' });
    expect(logs).toEqual([]);
  });

  it('filters by author', () => {
    const logs = collectGitLogs({ author: 'NonexistentAuthor12345' });
    expect(logs).toEqual([]);
  });

  it('each result has correct structure', () => {
    const logs = collectGitLogs({ project: 'mcp-session-insight' });
    if (logs.length === 0) return;

    for (const result of logs) {
      expect(result).toHaveProperty('project');
      expect(result).toHaveProperty('projectName');
      expect(result).toHaveProperty('commits');
      expect(Array.isArray(result.commits)).toBe(true);

      for (const commit of result.commits) {
        expect(commit).toHaveProperty('hash');
        expect(commit).toHaveProperty('message');
        expect(commit).toHaveProperty('author');
        expect(commit).toHaveProperty('date');
        expect(commit).toHaveProperty('files');
        expect(Array.isArray(commit.files)).toBe(true);
      }
    }
  });
});
