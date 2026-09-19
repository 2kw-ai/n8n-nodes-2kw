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

  it('lists resources alphabetically with Agent first', () => {
    const instance = new TwoKw();
    const resourceField = instance.description.properties.find((p) => p.name === 'resource');
    const names = (resourceField?.options as { name: string }[]).map((o) => o.name);
    expect(names[0]).toBe('Agent');
    expect(names).toEqual([...names].sort());
    expect(resourceField?.default).toBe('schema');
  });

  it('declares the Send Message fields the agent operation reads', () => {
    const props = new TwoKw().description.properties.filter(
      (p) => p.displayOptions?.show?.resource?.includes('agent'),
    );
    const byName = Object.fromEntries(props.map((p) => [p.name, p]));
    expect(Object.keys(byName).sort()).toEqual([
      'agent',
      'decideOptions',
      'decision',
      'label',
      'message',
      'operation',
      'options',
      'reason',
      'rememberForConversation',
      'responseId',
    ]);
    const optionNames = (byName.options.options as { name: string; displayName: string }[]).map(
      (o) => o.displayName,
    );
    expect(optionNames).toEqual([...optionNames].sort());
    expect((byName.options.options as { name: string }[]).map((o) => o.name)).toEqual([
      'binaryProperties',
      'conversationId',
      'previousResponseId',
      'returnPausedRuns',
      'simplify',
    ]);
  });

  it('declares Decide Approval next to Send Message, operations sorted (#660)', () => {
    const props = new TwoKw().description.properties;
    const operation = props.find(
      (p) => p.name === 'operation' && p.displayOptions?.show?.resource?.includes('agent'),
    );
    const names = (operation?.options as { name: string; value: string }[]).map((o) => o.name);
    expect(names).toEqual(['Decide Approval', 'Send Message']);
    expect(operation?.default).toBe('sendMessage');

    const shownFor = (name: string) =>
      props.find((p) => p.name === name && p.displayOptions?.show?.resource?.includes('agent'))
        ?.displayOptions?.show?.operation;
    expect(shownFor('agent')).toEqual(['sendMessage', 'decideApproval']);
    expect(shownFor('label')).toEqual(['sendMessage', 'decideApproval']);
    expect(shownFor('message')).toEqual(['sendMessage']);
    for (const name of ['responseId', 'decision', 'reason', 'rememberForConversation', 'decideOptions']) {
      expect(shownFor(name)).toEqual(['decideApproval']);
    }

    const decision = props.find((p) => p.name === 'decision');
    expect((decision?.options as { value: string }[]).map((o) => o.value)).toEqual(['approve', 'reject']);
    expect(decision?.default).toBe('reject');
    // Remembering is an approval-only choice; the backend refuses it on a rejection.
    const remember = props.find((p) => p.name === 'rememberForConversation');
    expect(remember?.displayOptions?.show?.decision).toEqual(['approve']);
    const decideOptions = props.find((p) => p.name === 'decideOptions');
    expect((decideOptions?.options as { name: string }[]).map((o) => o.name)).toEqual([
      'returnPausedRuns',
      'simplify',
    ]);
  });

  it('routes the agent resource to its handler', async () => {
    const ctx = {
      getInputData: () => [{ json: {} }],
      getNodeParameter: vi.fn((name: string) => (name === 'resource' ? 'agent' : 'nope')),
      getNode: vi.fn().mockReturnValue({ name: '2kw', type: 'twoKw', typeVersion: 1 }),
      continueOnFail: () => false,
    } as any;
    await expect(new TwoKw().execute.call(ctx)).rejects.toThrow('Unknown agent operation: nope');
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
