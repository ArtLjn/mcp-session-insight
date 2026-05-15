import { describe, it, expect } from 'vitest';
import { MessageType, SessionKind } from '../src/models.js';

describe('MessageType enum', () => {
  it('should have correct values', () => {
    expect(MessageType.USER).toBe('user');
    expect(MessageType.ASSISTANT).toBe('assistant');
    expect(MessageType.QUEUE_OPERATION).toBe('queue-operation');
  });
});

describe('SessionKind enum', () => {
  it('should have correct values', () => {
    expect(SessionKind.INTERACTIVE).toBe('interactive');
    expect(SessionKind.PRINT).toBe('print');
  });
});
