import { describe, it, expect, vi } from 'vitest';
import { executeAgent, buildAgentModel } from '../nodes/TwoKw/operations/agent';

type Binary = Record<string, { mimeType?: string; fileName?: string }>;

function makeCtx(
  params: Record<string, unknown>,
  opts: { responses?: unknown[]; binary?: Binary } = {},
) {
  const queue = [...(opts.responses ?? [])];
  const fn = vi.fn().mockImplementation(async () => queue.shift());
  const ctx: any = {
    helpers: {
      httpRequestWithAuthentication: fn,
      getBinaryDataBuffer: vi.fn(async (_i: number, prop: string) => Buffer.from(`DATA-${prop}`)),
    },
    getCredentials: vi.fn().mockResolvedValue({ baseUrl: 'https://api.2kw.ai', apiKey: 'k' }),
    getNodeParameter: vi.fn((name: string, _i: number, fallback?: unknown) => {
      if (name in params) return params[name];
      if (fallback !== undefined) return fallback;
      throw new Error(`unexpected parameter ${name}`);
    }),
    getInputData: vi.fn().mockReturnValue([{ json: {}, binary: opts.binary }]),
    getNode: vi.fn().mockReturnValue({ name: '2kw' }),
  };
  return { ctx, fn };
}

const baseParams = {
  agent: { mode: 'list', value: 'ag-1' },
  label: { mode: 'list', value: '' },
  message: 'Hello agent',
  options: {},
};

function completed(overrides: Record<string, unknown> = {}) {
  return {
    id: 'resp_1',
    object: 'response',
    status: 'completed',
    model: 'agent/ag-1',
    output: [
      {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'Hi there' }],
      },
    ],
    usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 },
    conversation: { id: 'conv_1' },
    ...overrides,
  };
}

describe('buildAgentModel', () => {
  it('omits the label suffix when the label is empty', () => {
    expect(buildAgentModel('ag-1', '')).toBe('agent/ag-1');
  });

  it('appends the label after @', () => {
    expect(buildAgentModel('support', 'prod')).toBe('agent/support@prod');
  });

  it('keeps an @ in the agent name when the label is empty', () => {
    expect(buildAgentModel('ops@acme', '')).toBe('agent/ops@acme@');
  });

  it('appends the label after an agent name containing @', () => {
    expect(buildAgentModel('ops@acme', 'prod')).toBe('agent/ops@acme@prod');
  });
});

describe('Agent resource — Send Message', () => {
  it('posts a text-only turn with only model and input', async () => {
    const { ctx, fn } = makeCtx(baseParams, { responses: [completed()] });

    await executeAgent.call(ctx, 0, 'sendMessage');

    expect(fn).toHaveBeenCalledTimes(1);
    const opts = fn.mock.calls[0][1];
    expect(opts.method).toBe('POST');
    expect(opts.url).toBe('https://api.2kw.ai/v1/responses');
    expect(opts.body).toEqual({
      model: 'agent/ag-1',
      input: [
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Hello agent' }],
        },
      ],
    });
  });

  it('uses the label and passes conversation and previous response ids through', async () => {
    const { ctx, fn } = makeCtx(
      {
        ...baseParams,
        agent: { mode: 'id', value: 'support' },
        label: { mode: 'id', value: ' prod ' },
        options: { conversationId: 'conv_9', previousResponseId: 'resp_8' },
      },
      { responses: [completed()] },
    );

    await executeAgent.call(ctx, 0, 'sendMessage');

    const body = fn.mock.calls[0][1].body;
    expect(body.model).toBe('agent/support@prod');
    expect(body.conversation).toBe('conv_9');
    expect(body.previous_response_id).toBe('resp_8');
    expect(body).not.toHaveProperty('stream');
    expect(body).not.toHaveProperty('store');
  });

  it('trims continuation ids and drops blank ones', async () => {
    const { ctx, fn } = makeCtx(
      { ...baseParams, options: { conversationId: '  ', previousResponseId: ' resp_8 ' } },
      { responses: [completed()] },
    );

    await executeAgent.call(ctx, 0, 'sendMessage');

    const body = fn.mock.calls[0][1].body;
    expect(body).not.toHaveProperty('conversation');
    expect(body.previous_response_id).toBe('resp_8');
  });

  it('uploads each binary property to /v1/files before the turn and attaches the file ids', async () => {
    const { ctx, fn } = makeCtx(
      { ...baseParams, options: { binaryProperties: 'data, invoice ,' } },
      {
        binary: {
          data: { mimeType: 'image/png', fileName: 'photo.png' },
          invoice: { mimeType: 'application/pdf', fileName: 'invoice.pdf' },
        },
        responses: [
          { id: 'file_a', object: 'file', filename: 'photo.png', purpose: 'agent_input' },
          { id: 'file_b', object: 'file', filename: 'invoice.pdf', purpose: 'agent_input' },
          completed(),
        ],
      },
    );

    await executeAgent.call(ctx, 0, 'sendMessage');

    expect(fn).toHaveBeenCalledTimes(3);
    const upload1 = fn.mock.calls[0][1];
    expect(upload1.url).toBe('https://api.2kw.ai/v1/files');
    expect(upload1.json).toBe(false);
    expect(upload1.formData.purpose).toBe('agent_input');
    expect(upload1.formData.file.options).toEqual({ filename: 'photo.png', contentType: 'image/png' });
    expect(fn.mock.calls[1][1].formData.file.options.filename).toBe('invoice.pdf');

    const turn = fn.mock.calls[2][1];
    expect(turn.url).toBe('https://api.2kw.ai/v1/responses');
    expect(turn.body.input[0].content).toEqual([
      { type: 'input_text', text: 'Hello agent' },
      { type: 'input_file', file_id: 'file_a', filename: 'photo.png' },
      { type: 'input_file', file_id: 'file_b', filename: 'invoice.pdf' },
    ]);
  });

  it('throws before any request when a binary property is missing', async () => {
    const { ctx, fn } = makeCtx(
      { ...baseParams, options: { binaryProperties: 'nope' } },
      { binary: {} },
    );

    await expect(executeAgent.call(ctx, 0, 'sendMessage')).rejects.toThrow(
      'Binary property "nope" not found on input item',
    );
    expect(fn).not.toHaveBeenCalled();
  });

  it('returns a simplified item with joined assistant text on completed', async () => {
    const response = completed({
      output: [
        { type: 'reasoning', summary: [] },
        { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Part one' }] },
        { type: 'function_call', name: 'lookup', call_id: 'c1', arguments: '{}' },
        {
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'output_text', text: 'Part two' },
            { type: 'refusal', refusal: 'no' },
          ],
        },
      ],
    });
    const { ctx } = makeCtx(baseParams, { responses: [response] });

    const result = await executeAgent.call(ctx, 0, 'sendMessage');

    expect(result).toEqual([
      {
        json: {
          text: 'Part one\n\nPart two',
          status: 'completed',
          responseId: 'resp_1',
          conversationId: 'conv_1',
          conversationMode: null,
          model: 'agent/ag-1',
          usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 },
        },
        pairedItem: 0,
      },
    ]);
  });

  it('returns incomplete runs with the reason instead of throwing', async () => {
    const response = completed({
      status: 'incomplete',
      incomplete_details: { reason: 'max_tool_iterations' },
      conversation: null,
    });
    const { ctx } = makeCtx(baseParams, { responses: [response] });

    const [item] = await executeAgent.call(ctx, 0, 'sendMessage');

    expect(item.json.status).toBe('incomplete');
    expect(item.json.incompleteReason).toBe('max_tool_iterations');
    expect(item.json.conversationId).toBeNull();
  });

  it('returns the raw response when Simplify Output is off', async () => {
    const response = completed();
    const { ctx } = makeCtx(
      { ...baseParams, options: { simplify: false } },
      { responses: [response] },
    );

    const result = await executeAgent.call(ctx, 0, 'sendMessage');

    expect(result).toEqual([{ json: response, pairedItem: 0 }]);
  });

  it('rejects an unknown operation', async () => {
    const { ctx } = makeCtx(baseParams);
    await expect(executeAgent.call(ctx, 0, 'nope')).rejects.toThrow('Unknown agent operation: nope');
  });

  it('appends the Mode option as a backbone:mode item after the message (#656)', async () => {
    const { ctx, fn } = makeCtx(
      { ...baseParams, options: { mode: 'plan' } },
      { responses: [completed({ conversation_mode: 'plan' })] },
    );

    const [item] = await executeAgent.call(ctx, 0, 'sendMessage');

    expect(fn.mock.calls[0][1].body.input).toEqual([
      { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Hello agent' }] },
      { type: 'backbone:mode', mode: 'plan' },
    ]);
    expect(item.json.conversationMode).toBe('plan');
  });

  it('sends no mode item without the option and reads a missing echo as null (#656)', async () => {
    const { ctx, fn } = makeCtx(baseParams, { responses: [completed()] });

    const [item] = await executeAgent.call(ctx, 0, 'sendMessage');

    const input = fn.mock.calls[0][1].body.input as { type: string }[];
    expect(input.some((i) => i.type === 'backbone:mode')).toBe(false);
    expect(item.json.conversationMode).toBeNull();
  });

  it('reads an unknown echoed mode as null (#656)', async () => {
    const { ctx } = makeCtx(baseParams, { responses: [completed({ conversation_mode: 'yolo' })] });
    const [item] = await executeAgent.call(ctx, 0, 'sendMessage');
    expect(item.json.conversationMode).toBeNull();
  });
});

describe('Agent resource — paused runs', () => {
  it('throws naming every pending approval and the fix', async () => {
    const response = completed({
      id: 'resp_p',
      status: 'requires_action',
      output: [
        {
          type: 'backbone:approval_request',
          id: 'apreq_1',
          call_id: 'c1',
          tool: 'create_invoice',
          arguments: '{}',
          policy_class: 'write',
          hmac: 'h1',
          status: 'in_progress',
        },
        {
          type: 'backbone:approval_request',
          id: 'apreq_0',
          call_id: 'c0',
          tool: 'read_customer',
          arguments: '{}',
          policy_class: 'write',
          hmac: 'h0',
          status: 'completed',
        },
        {
          type: 'backbone:approval_request',
          id: 'apreq_2',
          call_id: 'c2',
          tool: 'send_email',
          arguments: '{}',
          policy_class: 'write',
          hmac: 'h2',
          status: 'in_progress',
        },
      ],
    });
    const { ctx } = makeCtx(baseParams, { responses: [response] });

    const error = await executeAgent.call(ctx, 0, 'sendMessage').catch((e: unknown) => e);

    expect((error as Error).message).toBe(
      'Agent paused for approval: create_invoice (apreq_1), send_email (apreq_2)',
    );
    expect((error as { description?: string }).description).toBe(
      'Response resp_p is waiting for a human decision, and n8n runs agents unattended. ' +
        "Change this agent's hitlPolicy so these tools no longer require approval " +
        '(set `classes.write` to `auto` once auto-approval is available), ' +
        'or remove them from agents you call from n8n.',
    );
  });

  it('throws for a relay function_call n8n cannot execute', async () => {
    const response = completed({
      id: 'resp_r',
      status: 'requires_action',
      output: [
        { type: 'function_call', id: 'fc_0', call_id: 'c0', name: 'lookup_customer', arguments: '{}', status: 'completed' },
        { type: 'function_call_output', id: 'fco_0', call_id: 'c0', output: 'ok', status: 'completed' },
        { type: 'function_call', id: 'fc_1', call_id: 'c1', name: 'open_tab', arguments: '{}', status: 'in_progress' },
      ],
    });
    const { ctx } = makeCtx(baseParams, { responses: [response] });

    const error = await executeAgent.call(ctx, 0, 'sendMessage').catch((e: unknown) => e);

    expect((error as Error).message).toBe(
      'Agent requested client-side tool open_tab, which n8n cannot execute',
    );
    expect((error as { description?: string }).description ?? '').toContain('resp_r');
  });

  it('names every pending relay tool', async () => {
    const response = completed({
      id: 'resp_r2',
      status: 'requires_action',
      output: [
        { type: 'function_call', id: 'fc_1', call_id: 'c1', name: 'open_tab', arguments: '{}', status: 'in_progress' },
        { type: 'function_call', id: 'fc_2', call_id: 'c2', name: 'fill_form', arguments: '{}', status: 'in_progress' },
      ],
    });
    const { ctx } = makeCtx(baseParams, { responses: [response] });

    const error = await executeAgent.call(ctx, 0, 'sendMessage').catch((e: unknown) => e);

    expect((error as Error).message).toBe(
      'Agent requested client-side tool open_tab, fill_form, which n8n cannot execute',
    );
  });

  it('throws the unexpected-status error when requires_action has nothing pending', async () => {
    const response = completed({
      status: 'requires_action',
      output: [
        { type: 'function_call', id: 'fc_0', call_id: 'c0', name: 'lookup_customer', arguments: '{}', status: 'completed' },
      ],
    });
    const { ctx } = makeCtx(baseParams, { responses: [response] });

    await expect(executeAgent.call(ctx, 0, 'sendMessage')).rejects.toThrow(
      'Agent run ended with unexpected status "requires_action"',
    );
  });

  it('throws for any status it does not know, even with Simplify off', async () => {
    const { ctx } = makeCtx(
      { ...baseParams, options: { simplify: false } },
      { responses: [completed({ status: 'failed' })] },
    );

    await expect(executeAgent.call(ctx, 0, 'sendMessage')).rejects.toThrow(
      'Agent run ended with unexpected status "failed"',
    );
  });
});
