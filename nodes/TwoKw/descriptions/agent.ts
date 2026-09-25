import { INodeProperties } from 'n8n-workflow';

const showSendMessage = { resource: ['agent'], operation: ['sendMessage'] };
const showDecideApproval = { resource: ['agent'], operation: ['decideApproval'] };
const showAgentRun = { resource: ['agent'], operation: ['sendMessage', 'decideApproval'] };

const returnPausedRuns: INodeProperties = {
  displayName: 'Return Paused Runs',
  name: 'returnPausedRuns',
  type: 'boolean',
  default: false,
  description:
    'Whether to return a run that pauses for approval as an item (status requires_action, with pendingApprovals) instead of failing, so Agent › Decide Approval can continue it',
};

const simplifyOutput: INodeProperties = {
  displayName: 'Simplify Output',
  name: 'simplify',
  type: 'boolean',
  default: true,
  description: 'Whether to return text, status, IDs and usage instead of the raw response',
};

/**
 * The end user's conversation mode (#656). Absent until added: a workflow that never adds it
 * sends no backbone:mode item (S3 D2). Values sorted by name, as the node's other options are.
 */
const conversationMode: INodeProperties = {
  displayName: 'Mode',
  name: 'mode',
  type: 'options',
  default: 'ask',
  description:
    "Conversation mode for this and later turns of the conversation. Leave the option out to keep the conversation's mode.",
  options: [
    { name: 'Ask', value: 'ask', description: 'No automatic approver. Calls that need approval wait for a person.' },
    { name: 'Auto', value: 'auto', description: "The operator's policy as written, automatic approver included" },
    { name: 'Plan', value: 'plan', description: 'Read only. Anything that could change something is refused.' },
  ],
};

export const agentOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: { show: { resource: ['agent'] } },
  default: 'sendMessage',
  options: [
    {
      name: 'Decide Approval',
      value: 'decideApproval',
      description: 'Approve or reject every pending approval of a paused run and continue it',
      action: 'Decide the approvals of a paused agent run',
    },
    {
      name: 'Send Message',
      value: 'sendMessage',
      description: 'Run one turn of a stored agent',
      action: 'Send a message to an agent',
    },
  ],
};

export const agentFields: INodeProperties[] = [
  {
    displayName: 'Agent',
    name: 'agent',
    type: 'resourceLocator',
    default: { mode: 'list', value: '' },
    required: true,
    displayOptions: { show: showAgentRun },
    description: 'Pick from a list, or enter an agent ID or name',
    modes: [
      {
        displayName: 'From List',
        name: 'list',
        type: 'list',
        typeOptions: { searchListMethod: 'searchAgents', searchable: true },
      },
      {
        displayName: 'By ID or Name',
        name: 'id',
        type: 'string',
        placeholder: 'support-agent',
      },
    ],
  },
  {
    displayName: 'Label',
    name: 'label',
    type: 'resourceLocator',
    default: { mode: 'list', value: '' },
    displayOptions: { show: showAgentRun },
    description:
      'Optional. Run the agent version this label points at (e.g. "prod"). Empty runs the latest version. To decide approvals, use the label the paused run used. The list needs the agent picked from the list or by ID.',
    modes: [
      {
        displayName: 'From List',
        name: 'list',
        type: 'list',
        typeOptions: { searchListMethod: 'searchAgentLabels', searchable: false },
      },
      {
        displayName: 'By Name',
        name: 'id',
        type: 'string',
        placeholder: 'prod',
      },
    ],
  },
  {
    displayName: 'Message',
    name: 'message',
    type: 'string',
    required: true,
    default: '',
    typeOptions: { rows: 4 },
    displayOptions: { show: showSendMessage },
    description: 'The user message the agent answers',
  },
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: { show: showSendMessage },
    options: [
      {
        displayName: 'Binary Properties',
        name: 'binaryProperties',
        type: 'string',
        default: '',
        placeholder: 'data, invoice',
        description: 'Comma-separated binary properties of the input item to attach as files',
      },
      {
        displayName: 'Conversation ID',
        name: 'conversationId',
        type: 'string',
        default: '',
        description: 'Continue an existing conversation',
      },
      conversationMode,
      {
        displayName: 'Previous Response ID',
        name: 'previousResponseId',
        type: 'string',
        default: '',
        description: 'Continue from a previous response of this agent',
      },
      returnPausedRuns,
      simplifyOutput,
    ],
  },
  {
    displayName: 'Response ID',
    name: 'responseId',
    type: 'string',
    required: true,
    default: '',
    placeholder: 'resp_...',
    displayOptions: { show: showDecideApproval },
    description:
      'The paused run to continue: the responseId of a Send Message (or Decide Approval) item returned with Return Paused Runs on',
  },
  {
    displayName: 'Decision',
    name: 'decision',
    type: 'options',
    required: true,
    default: 'reject',
    displayOptions: { show: showDecideApproval },
    description:
      'Applied to every pending approval of the response; the platform accepts a continuation only when all of them are decided',
    options: [
      { name: 'Approve All', value: 'approve', description: 'Let every waiting tool call run' },
      { name: 'Reject All', value: 'reject', description: 'Refuse every waiting tool call; the agent is told' },
    ],
  },
  {
    displayName: 'Reason',
    name: 'reason',
    type: 'string',
    default: '',
    displayOptions: { show: showDecideApproval },
    description: 'Optional. Recorded on every decision; on a rejection the agent reads it.',
  },
  {
    displayName: 'Remember for Conversation',
    name: 'rememberForConversation',
    type: 'boolean',
    default: false,
    displayOptions: { show: { ...showDecideApproval, decision: ['approve'] } },
    description:
      'Whether to also approve later calls of the same tools in this conversation without asking. Destructive tools are approved once and never remembered.',
  },
  {
    displayName: 'Options',
    name: 'decideOptions',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: { show: showDecideApproval },
    options: [conversationMode, returnPausedRuns, simplifyOutput],
  },
];
