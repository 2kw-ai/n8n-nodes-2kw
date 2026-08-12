import { describe, it, expect } from 'vitest';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import type { INode } from 'n8n-workflow';
import { toNodeError } from '../nodes/TwoKw/errors';

const node = { name: '2kw', type: 'twoKw', typeVersion: 1, position: [0, 0], parameters: {} } as INode;

describe('toNodeError', () => {
  it('passes a NodeOperationError through untouched', () => {
    const original = new NodeOperationError(node, 'Maximum 10 binary images per extraction');
    expect(toNodeError(node, original, 0)).toBe(original);
  });

  it('passes a NodeApiError through untouched', () => {
    const original = new NodeApiError(node, { message: 'boom', httpCode: '500' });
    expect(toNodeError(node, original, 0)).toBe(original);
  });

  it('wraps a raw Error in a NodeApiError, keeping its message', () => {
    const wrapped = toNodeError(node, new Error('network down'), 3);
    expect(wrapped).toBeInstanceOf(NodeApiError);
    expect(wrapped.message).toContain('network down');
  });
});
