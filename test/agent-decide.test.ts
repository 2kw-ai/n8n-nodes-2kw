import { describe, it, expect, vi } from 'vitest';
import { NodeApiError } from 'n8n-workflow';
import {
  approvalResponseItems,
  executeAgent,
  gatewayError,
} from '../nodes/TwoKw/operations/agent';

/** A queued response the fake HTTP helper throws instead of returning. */
class Rejection {
  constructor(readonly error: unknown) {}
}

function makeCtx(params: Record<string, unknown>, responses: unknown[] = []) {
  const queue = [...responses];
  const fn = vi.fn().mockImplementation(async () => {
    const next = queue.shift();
    if (next instanceof Rejection) throw next.error;
    return next;
  });
  const ctx: any = {
    helpers: { httpRequestWithAuthentication: fn },
    getCredentials: vi.fn().mockResolvedValue({ baseUrl: 'https://api.2kw.ai', apiKey: 'k' }),
    getNodeParameter: vi.fn((name: string, _i: number, fallback?: unknown) => {
      if (name in params) return params[name];
      if (fallback !== undefined) return fallback;
      throw new Error(`unexpected parameter ${name}`);
    }),
    getInputData: vi.fn().mockReturnValue([{ json: {} }]),
    getNode: vi.fn().mockReturnValue({ name: '2kw' }),
  };
  return { ctx, fn };
}

const AGENT_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

function completed(overrides: Record<string, unknown> = {}) {
  return {
    id: 'resp_2',
    object: 'response',
    status: 'completed',
    model: 'agent/support@4',
    output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Done' }] }],
    usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 },
    conversation: { id: 'conv_1' },
    ...overrides,
  };
}

function pausedRun(overrides: Record<string, unknown> = {}) {
  return completed({
    id: 'resp_p',
    status: 'requires_action',
    output: [
      { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'I need to write.' }] },
      {
        type: 'backbone:approval_request',
        id: 'apreq_1',
        call_id: 'c1',
        tool: 'create_invoice',
        arguments: '{"amount":12}',
        policy_class: 'write',
        hmac: 'h1',
        status: 'in_progress',
        decided_by: null,
        reason: 'amount above the auto limit',
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
        decided_by: 'auto:gpt-4.1-mini',
        reason: 'read-only lookup',
      },
    ],
    ...overrides,
  });
}

const pendingPage = (rows: Record<string, unknown>[], last = true) => ({ content: rows, last });

const sendParams = {
  agent: { mode: 'list', value: AGENT_ID },
  label: { mode: 'list', value: '' },
  message: 'Invoice ACME for 12 EUR',
};

const decideParams = {
  agent: { mode: 'list', value: AGENT_ID },
  label: { mode: 'list', value: '' },
  responseId: ' resp_p ',
  decision: 'approve',
  reason: '',
  rememberForConversation: false,
  decideOptions: {},
};

const refusal = (code: string, message: string) =>
  new Rejection({ response: { status: 400, data: { error: { message, type: 'invalid_request_error', code } } } });

describe('Agent › Send Message › Return Paused Runs (#660)', () => {
  it('returns an approval pause as an item listing only the pending approvals', async () => {
    const { ctx } = makeCtx({ ...sendParams, options: { returnPausedRuns: true } }, [pausedRun()]);

    const [item] = await executeAgent.call(ctx, 0, 'sendMessage');

    expect(item.json).toEqual({
      text: 'I need to write.',
      status: 'requires_action',
      responseId: 'resp_p',
      conversationId: 'conv_1',
      model: 'agent/support@4',
      usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 },
      pendingApprovals: [
        {
          approvalId: 'apreq_1',
          tool: 'create_invoice',
          arguments: '{"amount":12}',
          policyClass: 'write',
          reason: 'amount above the auto limit',
        },
      ],
    });
  });

  it('still fails an approval pause when the option is off', async () => {
    const { ctx } = makeCtx({ ...sendParams, options: {} }, [pausedRun()]);

    await expect(executeAgent.call(ctx, 0, 'sendMessage')).rejects.toThrow(
      'Agent paused for approval: create_invoice (apreq_1)',
    );
  });

  it('still fails a relay pause, which n8n cannot execute', async () => {
    const relay = completed({
      id: 'resp_r',
      status: 'requires_action',
      output: [
        { type: 'function_call', id: 'fc_1', call_id: 'c1', name: 'open_tab', arguments: '{}', status: 'in_progress' },
      ],
    });
    const { ctx } = makeCtx({ ...sendParams, options: { returnPausedRuns: true } }, [relay]);

    await expect(executeAgent.call(ctx, 0, 'sendMessage')).rejects.toThrow(
      'Agent requested client-side tool open_tab, which n8n cannot execute',
    );
  });
});

describe('approvalResponseItems (#660)', () => {
  const rows = [
    { id: 'apreq_1', hmac: 'h1', policyClass: 'WRITE' },
    { id: 'apreq_2', hmac: 'h2', policyClass: 'DESTRUCTIVE' },
  ];

  it('uses the backend field names and omits an empty reason', () => {
    expect(approvalResponseItems(rows, 'reject', '', true)).toEqual([
      { type: 'backbone:approval_response', approval_id: 'apreq_1', decision: 'reject', hmac: 'h1' },
      { type: 'backbone:approval_response', approval_id: 'apreq_2', decision: 'reject', hmac: 'h2' },
    ]);
  });

  it('remembers approvals for the conversation, except a destructive call', () => {
    expect(approvalResponseItems(rows, 'approve', 'ok by finance', true)).toEqual([
      {
        type: 'backbone:approval_response',
        approval_id: 'apreq_1',
        decision: 'approve',
        hmac: 'h1',
        reason: 'ok by finance',
        remember: 'conversation',
      },
      {
        type: 'backbone:approval_response',
        approval_id: 'apreq_2',
        decision: 'approve',
        hmac: 'h2',
        reason: 'ok by finance',
      },
    ]);
  });
});

describe('Agent › Decide Approval (#660)', () => {
  it('decides every pending approval of the response and continues the run', async () => {
    const { ctx, fn } = makeCtx({ ...decideParams, reason: ' checked ', rememberForConversation: true }, [
      pendingPage([
        { id: 'apreq_1', responseId: 'resp_p', hmac: 'h1', policyClass: 'WRITE' },
        { id: 'apreq_9', responseId: 'resp_other', hmac: 'h9', policyClass: 'WRITE' },
      ]),
      completed(),
    ]);

    const result = await executeAgent.call(ctx, 0, 'decideApproval');

    expect(fn).toHaveBeenCalledTimes(2);
    const list = fn.mock.calls[0][1];
    expect(list.method).toBe('GET');
    expect(list.url).toBe(`https://api.2kw.ai/v1/agents/${AGENT_ID}/approvals`);
    expect(list.qs).toEqual({ status: 'pending', page: 0, size: 100 });

    const turn = fn.mock.calls[1][1];
    expect(turn.method).toBe('POST');
    expect(turn.url).toBe('https://api.2kw.ai/v1/responses');
    expect(turn.body).toEqual({
      model: `agent/${AGENT_ID}`,
      previous_response_id: 'resp_p',
      input: [
        {
          type: 'backbone:approval_response',
          approval_id: 'apreq_1',
          decision: 'approve',
          hmac: 'h1',
          reason: 'checked',
          remember: 'conversation',
        },
      ],
    });
    expect(result).toEqual([
      {
        json: {
          text: 'Done',
          status: 'completed',
          responseId: 'resp_2',
          conversationId: 'conv_1',
          model: 'agent/support@4',
          usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 },
        },
        pairedItem: 0,
      },
    ]);
  });

  it('resolves an agent name to its id, pages the approvals and continues on the label', async () => {
    const { ctx, fn } = makeCtx(
      {
        ...decideParams,
        agent: { mode: 'id', value: 'support' },
        label: { mode: 'id', value: ' prod ' },
        decision: 'reject',
        rememberForConversation: true,
      },
      [
        { content: [{ id: 'other-id', name: 'support-v2' }, { id: AGENT_ID, name: 'support' }], last: true },
        pendingPage([{ id: 'apreq_1', responseId: 'resp_p', hmac: 'h1', policyClass: 'WRITE' }], false),
        pendingPage([{ id: 'apreq_2', responseId: 'resp_p', hmac: 'h2', policyClass: 'WRITE' }]),
        completed(),
      ],
    );

    await executeAgent.call(ctx, 0, 'decideApproval');

    expect(fn.mock.calls[0][1].url).toBe('https://api.2kw.ai/v1/agents');
    expect(fn.mock.calls[0][1].qs).toMatchObject({ search: 'support' });
    expect(fn.mock.calls[2][1].qs).toMatchObject({ status: 'pending', page: 1 });
    const body = fn.mock.calls[3][1].body;
    expect(body.model).toBe(`agent/${AGENT_ID}@prod`);
    // A rejection never remembers, whatever the toggle says.
    expect(body.input).toEqual([
      { type: 'backbone:approval_response', approval_id: 'apreq_1', decision: 'reject', hmac: 'h1' },
      { type: 'backbone:approval_response', approval_id: 'apreq_2', decision: 'reject', hmac: 'h2' },
    ]);
  });

  it('fails without a continuation when the agent name matches nothing exactly', async () => {
    const { ctx, fn } = makeCtx({ ...decideParams, agent: { mode: 'id', value: 'support' } }, [
      { content: [{ id: 'x', name: 'support-v2' }], last: true },
    ]);

    await expect(executeAgent.call(ctx, 0, 'decideApproval')).rejects.toThrow('Agent "support" not found');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('fails without a continuation when nothing is pending on the response', async () => {
    const { ctx, fn } = makeCtx(decideParams, [
      pendingPage([{ id: 'apreq_9', responseId: 'resp_other', hmac: 'h9' }]),
    ]);

    const error = await executeAgent.call(ctx, 0, 'decideApproval').catch((e: unknown) => e);

    expect((error as Error).message).toBe('No pending approvals on response resp_p');
    expect((error as { description?: string }).description).toContain('auto-approver');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('refuses a blank response id before any request', async () => {
    const { ctx, fn } = makeCtx({ ...decideParams, responseId: '  ' });

    await expect(executeAgent.call(ctx, 0, 'decideApproval')).rejects.toThrow('Response ID is required');
    expect(fn).not.toHaveBeenCalled();
  });

  it('returns a run that pauses again when Return Paused Runs is on', async () => {
    const { ctx } = makeCtx({ ...decideParams, decideOptions: { returnPausedRuns: true } }, [
      pendingPage([{ id: 'apreq_0', responseId: 'resp_p', hmac: 'h0', policyClass: 'WRITE' }]),
      pausedRun({ id: 'resp_q' }),
    ]);

    const [item] = await executeAgent.call(ctx, 0, 'decideApproval');

    expect(item.json.status).toBe('requires_action');
    expect(item.json.responseId).toBe('resp_q');
    expect((item.json.pendingApprovals as { approvalId: string }[]).map((a) => a.approvalId)).toEqual(['apreq_1']);
  });

  it('fails a run that pauses again by default', async () => {
    const { ctx } = makeCtx(decideParams, [
      pendingPage([{ id: 'apreq_0', responseId: 'resp_p', hmac: 'h0', policyClass: 'WRITE' }]),
      pausedRun({ id: 'resp_q' }),
    ]);

    await expect(executeAgent.call(ctx, 0, 'decideApproval')).rejects.toThrow(
      'Agent paused for approval: create_invoice (apreq_1)',
    );
  });

  it('turns the 400 for an automatically decided approval into a clear node error', async () => {
    const { ctx } = makeCtx(decideParams, [
      pendingPage([{ id: 'apreq_1', responseId: 'resp_p', hmac: 'h1', policyClass: 'WRITE' }]),
      refusal('invalid_approval_decision', 'approval apreq_1 was decided automatically and cannot be decided again'),
    ]);

    const error = await executeAgent.call(ctx, 0, 'decideApproval').catch((e: unknown) => e);

    expect((error as Error).message).toBe('2kw refused the decision on response resp_p');
    expect((error as { description?: string }).description).toBe(
      'An approval that was already decided — by the auto-approver or a conversation grant — accepts no decision. ' +
        'approval apreq_1 was decided automatically and cannot be decided again',
    );
  });

  it('names an approval that is no longer pending', async () => {
    const { ctx } = makeCtx(decideParams, [
      pendingPage([{ id: 'apreq_1', responseId: 'resp_p', hmac: 'h1' }]),
      refusal('unknown_approval_id', 'approval_id is not pending on the continued response'),
    ]);

    await expect(executeAgent.call(ctx, 0, 'decideApproval')).rejects.toThrow(
      'An approval is no longer pending on response resp_p',
    );
  });

  it('names pending approvals the decision did not cover', async () => {
    const { ctx } = makeCtx(decideParams, [
      pendingPage([{ id: 'apreq_1', responseId: 'resp_p', hmac: 'h1' }]),
      refusal('incomplete_tool_outputs', 'continuation must decide every pending approval; undecided: apreq_2'),
    ]);

    await expect(executeAgent.call(ctx, 0, 'decideApproval')).rejects.toThrow(
      'Response resp_p has pending approvals this decision did not cover',
    );
  });

  it('passes any other API error through as a NodeApiError', async () => {
    const { ctx } = makeCtx(decideParams, [
      pendingPage([{ id: 'apreq_1', responseId: 'resp_p', hmac: 'h1' }]),
      new Rejection({ response: { status: 500, data: { message: 'boom' } } }),
    ]);

    const error = await executeAgent.call(ctx, 0, 'decideApproval').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NodeApiError);
  });
});

describe('gatewayError (#660)', () => {
  const body = { error: { code: 'invalid_approval_decision', message: 'decided automatically' } };

  it('reads the code from a NodeApiError built around an axios-style response', () => {
    const wrapped = new NodeApiError({ name: '2kw' } as never, { response: { status: 400, data: body } } as never);
    expect(gatewayError(wrapped)).toEqual({ code: 'invalid_approval_decision', message: 'decided automatically' });
  });

  it('reads the code from a raw error carrying the response body', () => {
    expect(gatewayError({ response: { body } })).toEqual({
      code: 'invalid_approval_decision',
      message: 'decided automatically',
    });
  });

  it('returns nothing for an error without a gateway body', () => {
    expect(gatewayError(new Error('socket hang up'))).toEqual({});
    expect(gatewayError(undefined)).toEqual({});
  });
});
