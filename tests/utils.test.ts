import { describe, it, expect } from 'vitest';
import {
  decodeProjectPath,
  encodeProjectPath,
  extractTextFromMessage,
  parseTimestamp,
  shortPath,
  truncate,
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
