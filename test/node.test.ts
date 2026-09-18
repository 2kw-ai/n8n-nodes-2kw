import { describe, it, expect, vi } from 'vitest';
import { NodeOperationError } from 'n8n-workflow';
import { TwoKw } from '../nodes/TwoKw/TwoKw.node';

function makeExecuteCtx(opts: { resource: string; continueOnFail?: boolean }) {
  return {
    getInputData: () => [{ json: {} }],
    getNodeParameter: vi.fn((name: string) => (name === 'resource' ? opts.resource : 'run')),
    getNode: vi.fn().mockReturnValue({ name: '2kw', type: 'twoKw', typeVersion: 1 }),
    continueOnFail: () => opts.continueOnFail ?? false,
  } as any;
}

describe('TwoKw node', () => {
  it('declares a node type "2kw" with credential "2kwApi"', () => {
    const instance = new TwoKw();
    expect(instance.description.name).toBe('twoKw');
    expect(instance.description.displayName).toBe('2kw');
    expect(instance.description.credentials).toEqual([{ name: '2kwApi', required: true }]);
  });

  it('exposes a Resource parameter', () => {
    const instance = new TwoKw();
    const resourceField = instance.description.properties.find((p) => p.name === 'resource');
    expect(resourceField).toBeDefined();
    expect(resourceField?.type).toBe('options');
  });

  it('is offered as an AI Agent tool', () => {
    expect(new TwoKw().description.usableAsTool).toBe(true);
  });

  // execute() routes its catch through toNodeError (#363). The message an
  // operation wrote for the user has to survive that, rather than being
  // replaced by a NodeApiError default.
  it('surfaces an operation error unwrapped', async () => {
    const ctx = makeExecuteCtx({ resource: 'nope' });
    await expect(new TwoKw().execute.call(ctx)).rejects.toBeInstanceOf(NodeOperationError);
    await expect(new TwoKw().execute.call(ctx)).rejects.toThrow('Unknown resource: nope');
  });

  it('captures the error on the item when continueOnFail is set', async () => {
    const ctx = makeExecuteCtx({ resource: 'nope', continueOnFail: true });
    const result = await new TwoKw().execute.call(ctx);
    expect(result).toEqual([[{ json: { error: 'Unknown resource: nope' }, pairedItem: 0 }]]);
  });
});
