import {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  NodeOperationError,
} from 'n8n-workflow';
import { apiRequest, extractResourceId } from '../transport';

interface SendMessageOptions {
  binaryProperties?: string;
  conversationId?: string;
  previousResponseId?: string;
  simplify?: boolean;
}

interface OutputItem {
  type?: string;
  role?: string;
  content?: { type?: string; text?: string }[];
  id?: string;
  tool?: string;
  name?: string;
  status?: string;
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
  return json;
}

const APPROVAL_REQUEST = 'backbone:approval_request';

/**
 * n8n runs agents unattended (spec D2): a turn that waits for a human or for a
 * client-side tool fails the item loudly instead of reaching the workflow as
 * empty output.
 */
function assertNotPaused(
  ctx: IExecuteFunctions,
  response: AgentResponse,
  itemIndex: number,
): void {
  if (response.status === 'completed' || response.status === 'incomplete') return;

  const output = response.output ?? [];
  if (response.status === 'requires_action') {
    const pending = output.filter(
      (item) => item.type === APPROVAL_REQUEST && item.status === 'in_progress',
    );
    if (pending.length > 0) {
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

export async function executeAgent(
  this: IExecuteFunctions,
  itemIndex: number,
  operation: string,
): Promise<INodeExecutionData[]> {
  if (operation !== 'sendMessage') {
    throw new NodeOperationError(this.getNode(), `Unknown agent operation: ${operation}`, {
      itemIndex,
    });
  }

  const ref = extractResourceId(this.getNodeParameter('agent', itemIndex)).trim();
  const label = extractResourceId(this.getNodeParameter('label', itemIndex, '')).trim();
  const message = this.getNodeParameter('message', itemIndex) as string;
  const options = this.getNodeParameter('options', itemIndex, {}) as SendMessageOptions;

  const content: IDataObject[] = [{ type: 'input_text', text: message }];
  if (options.binaryProperties) {
    content.push(...(await uploadAttachments(this, itemIndex, options.binaryProperties)));
  }

  const body: IDataObject = {
    model: buildAgentModel(ref, label),
    input: [{ type: 'message', role: 'user', content }],
  };
  const conversationId = options.conversationId?.trim();
  const previousResponseId = options.previousResponseId?.trim();
  if (conversationId) body.conversation = conversationId;
  if (previousResponseId) body.previous_response_id = previousResponseId;

  const response = await apiRequest<AgentResponse>(this, 'POST', '/v1/responses', { body });
  assertNotPaused(this, response, itemIndex);

  const json = options.simplify === false ? (response as unknown as IDataObject) : simplify(response);
  return [{ json, pairedItem: itemIndex }];
}
