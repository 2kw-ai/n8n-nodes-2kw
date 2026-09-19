import {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  NodeOperationError,
} from 'n8n-workflow';
import { apiRequest, extractResourceId } from '../transport';

interface RunOptions {
  returnPausedRuns?: boolean;
  simplify?: boolean;
}

interface SendMessageOptions extends RunOptions {
  binaryProperties?: string;
  conversationId?: string;
  previousResponseId?: string;
}

interface OutputItem {
  type?: string;
  role?: string;
  content?: { type?: string; text?: string }[];
  id?: string;
  tool?: string;
  name?: string;
  status?: string;
  arguments?: string;
  policy_class?: string;
  reason?: string | null;
}

export interface AgentResponse {
  id: string;
  status: string;
  model?: string;
  output?: OutputItem[];
  usage?: IDataObject | null;
  incomplete_details?: { reason?: string } | null;
  conversation?: { id?: string } | null;
}

interface UploadedFile {
  id: string;
  filename?: string;
}

/** A `GET /v1/agents/{agentId}/approvals` row; only the fields a decision needs. */
interface ApprovalRow {
  id?: string;
  responseId?: string;
  hmac?: string;
  policyClass?: string;
  tool?: string;
}

interface Page<T> {
  content?: T[];
  last?: boolean;
}

/** `agent/<ref>` at the latest label (`agent/<ref>@` if the ref contains `@`), or `agent/<ref>@<label>`. */
export function buildAgentModel(ref: string, label: string): string {
  if (label) return `agent/${ref}@${label}`;
  return ref.includes('@') ? `agent/${ref}@` : `agent/${ref}`;
}

/** Every assistant `output_text` part, in output order — the resource has no `output_text` field. */
export function responseText(response: AgentResponse): string {
  const parts: string[] = [];
  for (const item of response.output ?? []) {
    if (item.type !== 'message' || item.role !== 'assistant') continue;
    for (const part of item.content ?? []) {
      if (part.type === 'output_text' && typeof part.text === 'string') parts.push(part.text);
    }
  }
  return parts.join('\n\n');
}

async function uploadAttachments(
  ctx: IExecuteFunctions,
  itemIndex: number,
  binaryProperties: string,
): Promise<{ type: 'input_file'; file_id: string; filename: string }[]> {
  const names = binaryProperties
    .split(',')
    .map((n) => n.trim())
    .filter((n) => n.length > 0);
  const item = ctx.getInputData()[itemIndex];

  // Validate every property before the first upload, so a typo never leaves
  // half the files uploaded for a turn that is not sent.
  const entries = names.map((name) => {
    const entry = item.binary?.[name];
    if (!entry) {
      throw new NodeOperationError(
        ctx.getNode(),
        `Binary property "${name}" not found on input item`,
        { itemIndex },
      );
    }
    return { name, entry };
  });

  const parts: { type: 'input_file'; file_id: string; filename: string }[] = [];
  for (const { name, entry } of entries) {
    const buffer = await ctx.helpers.getBinaryDataBuffer(itemIndex, name);
    const filename = entry.fileName ?? name;
    const file = await apiRequest<UploadedFile>(ctx, 'POST', '/v1/files', {
      formData: { purpose: 'agent_input' },
      binary: {
        fieldName: 'file',
        buffer,
        filename,
        mimeType: entry.mimeType ?? 'application/octet-stream',
      },
    });
    parts.push({ type: 'input_file', file_id: file.id, filename: file.filename ?? filename });
  }
  return parts;
}

const APPROVAL_REQUEST = 'backbone:approval_request';
const APPROVAL_RESPONSE = 'backbone:approval_response';

/**
 * Approval requests still waiting for a decision. Requests the auto-approver or a
 * conversation grant already decided carry another status and are not pending (#634).
 */
function pendingApprovalItems(response: AgentResponse): OutputItem[] {
  return (response.output ?? []).filter(
    (item) => item.type === APPROVAL_REQUEST && item.status === 'in_progress',
  );
}

function simplify(response: AgentResponse): IDataObject {
  const json: IDataObject = {
    text: responseText(response),
    status: response.status,
    responseId: response.id,
    conversationId: response.conversation?.id ?? null,
    model: response.model,
    usage: response.usage ?? null,
  };
  if (response.status === 'incomplete') {
    json.incompleteReason = response.incomplete_details?.reason ?? null;
  }
  if (response.status === 'requires_action') {
    json.pendingApprovals = pendingApprovalItems(response).map((item) => ({
      approvalId: item.id ?? null,
      tool: item.tool ?? null,
      arguments: item.arguments ?? null,
      policyClass: item.policy_class ?? null,
      reason: item.reason ?? null,
    }));
  }
  return json;
}

/**
 * n8n runs agents unattended (spec D2): a turn that waits for a human or for a
 * client-side tool fails the item loudly instead of reaching the workflow as
 * empty output. With Return Paused Runs on, an approval pause is returned as an
 * item instead, for a later Decide Approval (#660); a relay pause still fails.
 */
function assertNotPaused(
  ctx: IExecuteFunctions,
  response: AgentResponse,
  itemIndex: number,
  returnPausedRuns: boolean,
): void {
  if (response.status === 'completed' || response.status === 'incomplete') return;

  const output = response.output ?? [];
  if (response.status === 'requires_action') {
    const pending = pendingApprovalItems(response);
    if (pending.length > 0) {
      if (returnPausedRuns) return;
      throw new NodeOperationError(
        ctx.getNode(),
        `Agent paused for approval: ${pending.map((a) => `${a.tool} (${a.id})`).join(', ')}`,
        {
          itemIndex,
          description:
            `Response ${response.id} is waiting for a human decision, and n8n runs agents unattended. ` +
            "Change this agent's hitlPolicy so these tools no longer require approval " +
            '(set `classes.write` to `auto` once auto-approval is available), ' +
            'or remove them from agents you call from n8n.',
        },
      );
    }
    // Server tools that already ran precede the relay calls as completed
    // function_call items; only the in_progress ones wait for the caller.
    const relays = output.filter(
      (item) => item.type === 'function_call' && item.status === 'in_progress',
    );
    if (relays.length > 0) {
      throw new NodeOperationError(
        ctx.getNode(),
        `Agent requested client-side tool ${relays.map((r) => r.name).join(', ')}, which n8n cannot execute`,
        {
          itemIndex,
          description: `Response ${response.id} is waiting for the caller to run these tools.`,
        },
      );
    }
  }

  throw new NodeOperationError(
    ctx.getNode(),
    `Agent run ended with unexpected status "${response.status}"`,
    { itemIndex, description: `Response ${response.id}.` },
  );
}

function runResult(
  ctx: IExecuteFunctions,
  response: AgentResponse,
  itemIndex: number,
  options: RunOptions,
): INodeExecutionData[] {
  assertNotPaused(ctx, response, itemIndex, options.returnPausedRuns === true);
  const json = options.simplify === false ? (response as unknown as IDataObject) : simplify(response);
  return [{ json, pairedItem: itemIndex }];
}

async function sendMessage(ctx: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]> {
  const ref = extractResourceId(ctx.getNodeParameter('agent', itemIndex)).trim();
  const label = extractResourceId(ctx.getNodeParameter('label', itemIndex, '')).trim();
  const message = ctx.getNodeParameter('message', itemIndex) as string;
  const options = ctx.getNodeParameter('options', itemIndex, {}) as SendMessageOptions;

  const content: IDataObject[] = [{ type: 'input_text', text: message }];
  if (options.binaryProperties) {
    content.push(...(await uploadAttachments(ctx, itemIndex, options.binaryProperties)));
  }

  const body: IDataObject = {
    model: buildAgentModel(ref, label),
    input: [{ type: 'message', role: 'user', content }],
  };
  const conversationId = options.conversationId?.trim();
  const previousResponseId = options.previousResponseId?.trim();
  if (conversationId) body.conversation = conversationId;
  if (previousResponseId) body.previous_response_id = previousResponseId;

  const response = await apiRequest<AgentResponse>(ctx, 'POST', '/v1/responses', { body });
  return runResult(ctx, response, itemIndex, options);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 100;
const MAX_PAGES = 50;

/**
 * The approvals listing is addressed by agent id only, while the Agent field also
 * takes a name. A name is matched exactly; the API offers only a substring search.
 */
async function resolveAgentId(ctx: IExecuteFunctions, ref: string, itemIndex: number): Promise<string> {
  if (UUID.test(ref)) return ref;
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await apiRequest<Page<{ id: string; name: string }>>(ctx, 'GET', '/v1/agents', {
      query: { search: ref, page, size: PAGE_SIZE, sort: 'id,asc' },
    });
    const content = data?.content ?? [];
    const hit = content.find((a) => a.name === ref);
    if (hit) return hit.id;
    if (data?.last !== false || content.length === 0) break;
  }
  throw new NodeOperationError(ctx.getNode(), `Agent "${ref}" not found`, { itemIndex });
}

async function pendingApprovalRows(
  ctx: IExecuteFunctions,
  agentId: string,
  responseId: string,
): Promise<ApprovalRow[]> {
  const rows: ApprovalRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await apiRequest<Page<ApprovalRow>>(ctx, 'GET', '/v1/agents/{agentId}/approvals', {
      pathParams: { agentId },
      query: { status: 'pending', page, size: PAGE_SIZE },
    });
    const content = data?.content ?? [];
    rows.push(...content.filter((row) => row.responseId === responseId));
    if (data?.last !== false || content.length === 0) break;
  }
  return rows;
}

/**
 * One `backbone:approval_response` per pending approval, with the backend's field
 * names (ApprovalResponseItem). `remember` is sent only on an approval, and never for
 * a destructive call: the backend refuses both (ApprovalDecisionValidator).
 */
export function approvalResponseItems(
  rows: ApprovalRow[],
  decision: 'approve' | 'reject',
  reason: string,
  remember: boolean,
): IDataObject[] {
  return rows.map((row) => {
    const item: IDataObject = {
      type: APPROVAL_RESPONSE,
      approval_id: row.id,
      decision,
      hmac: row.hmac,
    };
    if (reason) item.reason = reason;
    if (remember && decision === 'approve' && (row.policyClass ?? '').toUpperCase() !== 'DESTRUCTIVE') {
      item.remember = 'conversation';
    }
    return item;
  });
}

/** The OpenAI-style `error.code` / `error.message` of a gateway error, wherever n8n put the body. */
export function gatewayError(error: unknown): { code?: string; message?: string } {
  const e = error as {
    context?: { data?: unknown };
    errorResponse?: { response?: { data?: unknown; body?: unknown } };
    cause?: { response?: { data?: unknown; body?: unknown } };
    response?: { data?: unknown; body?: unknown };
  } | null;
  const candidates = [
    e?.context?.data,
    e?.errorResponse?.response?.data,
    e?.errorResponse?.response?.body,
    e?.cause?.response?.data,
    e?.cause?.response?.body,
    e?.response?.data,
    e?.response?.body,
  ];
  for (const body of candidates) {
    const inner = (body as { error?: { code?: unknown; message?: unknown } } | undefined)?.error;
    if (inner && typeof inner.code === 'string') {
      return { code: inner.code, message: typeof inner.message === 'string' ? inner.message : undefined };
    }
  }
  return {};
}

/** Gateway refusals of a decision continuation (approval-gate spec §7), rewritten for a workflow author. */
function decisionError(
  ctx: IExecuteFunctions,
  error: unknown,
  itemIndex: number,
  responseId: string,
): unknown {
  const { code, message } = gatewayError(error);
  const detail = message ? ` ${message}` : '';
  switch (code) {
    case 'invalid_approval_decision':
      return new NodeOperationError(ctx.getNode(), `2kw refused the decision on response ${responseId}`, {
        itemIndex,
        description:
          `An approval that was already decided — by the auto-approver or a conversation grant — accepts no decision.${detail}`,
      });
    case 'unknown_approval_id':
      return new NodeOperationError(ctx.getNode(), `An approval is no longer pending on response ${responseId}`, {
        itemIndex,
        description: `It was cancelled or expired, or this is not the response that raised it.${detail}`,
      });
    case 'incomplete_tool_outputs':
      return new NodeOperationError(ctx.getNode(), `Response ${responseId} has pending approvals this decision did not cover`, {
        itemIndex,
        description: `Run Decide Approval again to decide them all.${detail}`,
      });
    case 'approval_hmac_mismatch':
      return new NodeOperationError(ctx.getNode(), `An approval of response ${responseId} does not match its tool call`, {
        itemIndex,
        description: `The approval binds other arguments than the call being released.${detail}`,
      });
    default:
      return error;
  }
}

async function decideApproval(ctx: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]> {
  const ref = extractResourceId(ctx.getNodeParameter('agent', itemIndex)).trim();
  const label = extractResourceId(ctx.getNodeParameter('label', itemIndex, '')).trim();
  const responseId = (ctx.getNodeParameter('responseId', itemIndex) as string).trim();
  const decision = ctx.getNodeParameter('decision', itemIndex) as string;
  const reason = (ctx.getNodeParameter('reason', itemIndex, '') as string).trim();
  const remember =
    decision === 'approve' && (ctx.getNodeParameter('rememberForConversation', itemIndex, false) as boolean);
  const options = ctx.getNodeParameter('decideOptions', itemIndex, {}) as RunOptions;

  if (!responseId) {
    throw new NodeOperationError(ctx.getNode(), 'Response ID is required', { itemIndex });
  }
  if (decision !== 'approve' && decision !== 'reject') {
    throw new NodeOperationError(ctx.getNode(), `Decision must be "approve" or "reject", got "${decision}"`, {
      itemIndex,
    });
  }

  const agentId = await resolveAgentId(ctx, ref, itemIndex);
  const rows = await pendingApprovalRows(ctx, agentId, responseId);
  // Never send a continuation without decisions: it would be a new turn, not a decision.
  if (rows.length === 0) {
    throw new NodeOperationError(ctx.getNode(), `No pending approvals on response ${responseId}`, {
      itemIndex,
      description:
        'They were already decided (by a person, a conversation grant or the auto-approver), ' +
        'or the response ID is not a paused run of this agent.',
    });
  }
  const unbound = rows.find((row) => !row.id || !row.hmac);
  if (unbound) {
    throw new NodeOperationError(ctx.getNode(), `Approval ${unbound.id ?? '?'} carries no binding and cannot be decided`, {
      itemIndex,
    });
  }

  // Continue on the agent id and the run's label: the platform resolves the approved
  // calls' tools from the continuation's version.
  const body: IDataObject = {
    model: buildAgentModel(agentId, label),
    previous_response_id: responseId,
    input: approvalResponseItems(rows, decision, reason, remember),
  };

  let response: AgentResponse;
  try {
    response = await apiRequest<AgentResponse>(ctx, 'POST', '/v1/responses', { body });
  } catch (error) {
    throw decisionError(ctx, error, itemIndex, responseId);
  }
  return runResult(ctx, response, itemIndex, options);
}

export async function executeAgent(
  this: IExecuteFunctions,
  itemIndex: number,
  operation: string,
): Promise<INodeExecutionData[]> {
  if (operation === 'sendMessage') return sendMessage(this, itemIndex);
  if (operation === 'decideApproval') return decideApproval(this, itemIndex);
  throw new NodeOperationError(this.getNode(), `Unknown agent operation: ${operation}`, {
    itemIndex,
  });
}
