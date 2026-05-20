import { describe, it, expect } from 'vitest';
import {
  decodeProjectPath,
  encodeProjectPath,
  extractTextFromMessage,
  parseTimestamp,
  shortPath,
  truncate,
  trigrams,
  jaccardTrigram,
  dedupByTrigram,
} from '../src/utils.js';

describe('decodeProjectPath', () => {
  it('decodes Claude Code path encoding', () => {
    expect(decodeProjectPath('-Users-ljn-Documents-demo')).toBe('/Users/ljn/Documents/demo');
  });

  it('returns plain path if no leading dash', () => {
    expect(decodeProjectPath('plain-path')).toBe('plain-path');
  });
});

describe('encodeProjectPath', () => {
  it('encodes path to Claude Code format', () => {
    expect(encodeProjectPath('/Users/ljn/.claude')).toBe('-Users-ljn--claude');
  });
});

describe('extractTextFromMessage', () => {
  it('extracts text from string content', () => {
    expect(extractTextFromMessage({ content: 'hello' })).toBe('hello');
  });

  it('extracts text from array content', () => {
    const msg = {
      content: [
        { type: 'text', text: 'hello' },
        { type: 'thinking', thinking: 'ignore' },
      ],
    };
    expect(extractTextFromMessage(msg)).toBe('hello');
  });
});

describe('parseTimestamp', () => {
  it('parses ISO string', () => {
    const result = parseTimestamp('2024-01-15T10:30:00Z');
    expect(result).toMatch(/2024-01-15/);
  });

  it('parses millisecond timestamp', () => {
    const result = parseTimestamp(1705315800000);
    expect(result).toMatch(/2024-01-15/);
  });
});

describe('shortPath', () => {
  it('shortens relative to cwd', () => {
    expect(shortPath('/Users/ljn/proj/src/main.ts', '/Users/ljn/proj')).toBe('src/main.ts');
  });

  it('shortens home to ~', () => {
    const home = process.env.HOME || '/Users/ljn';
    expect(shortPath(`${home}/.claude/settings.json`)).toBe('~/.claude/settings.json');
  });
});

describe('truncate', () => {
  it('returns short text unchanged', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates long text', () => {
    expect(truncate('hello world', 8)).toBe('hello...');
  });

  it('strips HTML tags', () => {
    expect(truncate('<tag>hello</tag>', 20)).toBe('hello');
  });
});

describe('trigrams', () => {
  it('extracts trigrams from a string', () => {
    const result = trigrams('abc');
    expect(result).toEqual(['abc']);
  });

  it('extracts multiple trigrams', () => {
    const result = trigrams('abcd');
    expect(result).toEqual(['abc', 'bcd']);
  });

  it('returns empty for short strings', () => {
    expect(trigrams('ab')).toEqual([]);
    expect(trigrams('')).toEqual([]);
  });
});

describe('jaccardTrigram', () => {
  it('returns 1 for identical strings', () => {
    expect(jaccardTrigram('hello world', 'hello world')).toBe(1);
  });

  it('returns 0 for completely different strings', () => {
    expect(jaccardTrigram('aaa', 'zzz')).toBe(0);
  });

  it('returns between 0 and 1 for partially similar', () => {
    const s = jaccardTrigram('hello world', 'hello there');
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
  });

  it('is case-insensitive', () => {
    expect(jaccardTrigram('Hello', 'hello')).toBe(1);
  });
});

describe('dedupByTrigram', () => {
  it('removes near-duplicate items (threshold=0.4, validated by spike)', () => {
    const items = ['帮我加个登录按钮', '帮我加个登录的按钮'];
    const result = dedupByTrigram(items, 0.4);
    expect(result).toHaveLength(1);
  });

  it('keeps semantically different items (threshold=0.4)', () => {
    const items = ['帮我加个按钮', '帮我加个搜索框'];
    const result = dedupByTrigram(items, 0.4);
    expect(result).toHaveLength(2);
  });

  it('handles empty array', () => {
    expect(dedupByTrigram([], 0.4)).toEqual([]);
  });

  it('handles single item', () => {
    expect(dedupByTrigram(['only one'], 0.4)).toEqual(['only one']);
  });
});
