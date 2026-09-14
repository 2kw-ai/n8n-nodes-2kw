import { INodeProperties } from 'n8n-workflow';

const showSendMessage = { resource: ['agent'], operation: ['sendMessage'] };

export const agentOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: { show: { resource: ['agent'] } },
  default: 'sendMessage',
  options: [
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
    displayOptions: { show: showSendMessage },
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
    displayOptions: { show: showSendMessage },
    description:
      'Optional. Run the agent version this label points at (e.g. "prod"). Empty runs the latest version. The list needs the agent picked from the list or by ID.',
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
      {
        displayName: 'Previous Response ID',
        name: 'previousResponseId',
        type: 'string',
        default: '',
        description: 'Continue from a previous response of this agent',
      },
      {
        displayName: 'Simplify Output',
        name: 'simplify',
        type: 'boolean',
        default: true,
        description:
          'Whether to return text, status, IDs and usage instead of the raw response',
      },
    ],
  },
];
