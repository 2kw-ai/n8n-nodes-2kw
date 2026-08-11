import { INodeProperties } from 'n8n-workflow';

export const extractionOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: { show: { resource: ['extraction'] } },
  default: 'run',
  options: [
    {
      name: 'Run',
      value: 'run',
      description: 'Extract structured data using a schema',
      action: 'Run an extraction',
    },
    {
      name: 'Get',
      value: 'get',
      description: 'Look up an existing extraction by ID',
      action: 'Get an extraction',
    },
    {
      name: 'Estimate',
      value: 'estimate',
      description: 'Estimate token usage for an extraction without running it',
      action: 'Estimate extraction tokens',
    },
  ],
};

const schemaResourceLocator = (operationScope: string[]): INodeProperties => ({
  displayName: 'Schema',
  name: 'schema',
  type: 'resourceLocator',
  default: { mode: 'list', value: '' },
  required: true,
  displayOptions: { show: { resource: ['extraction'], operation: operationScope } },
  description: 'Pick from a list or paste a schema ID',
  modes: [
    {
      displayName: 'From List',
      name: 'list',
      type: 'list',
      typeOptions: { searchListMethod: 'searchSchemas', searchable: true },
    },
    {
      displayName: 'By ID',
      name: 'id',
      type: 'string',
      placeholder: '78af6e26-30b4-4677-bb3f-a2494444380c',
    },
  ],
});

const schemaVersionResourceLocator = (operationScope: string[]): INodeProperties => ({
  displayName: 'Schema Version',
  name: 'schemaVersion',
  type: 'resourceLocator',
  default: { mode: 'list', value: '' },
  description:
    'Optional. Leave empty for the latest active version. Pick a specific version, a label, or paste an ID. Depends on selected Schema.',
  displayOptions: { show: { resource: ['extraction'], operation: operationScope } },
  modes: [
    {
      displayName: 'From Versions',
      name: 'list',
      type: 'list',
      typeOptions: { searchListMethod: 'searchSchemaVersions', searchable: false },
    },
    {
      displayName: 'From Labels',
      name: 'label',
      type: 'list',
      typeOptions: { searchListMethod: 'searchSchemaLabels', searchable: false },
    },
    {
      displayName: 'By ID',
      name: 'id',
      type: 'string',
      placeholder: '32d956ac-401d-43e7-9dcc-01c672e8f717',
    },
  ],
});

export const extractionFields: INodeProperties[] = [
  // Run op fields
  schemaResourceLocator(['run']),
  schemaVersionResourceLocator(['run']),
  {
    displayName: 'Model',
    name: 'model',
    type: 'string',
    required: true,
    default: 'openai/gpt-4o',
    description: 'Format: provider/model (e.g. openai/gpt-4o)',
    displayOptions: { show: { resource: ['extraction'], operation: ['run'] } },
  },
  {
    displayName: 'Input Text',
    name: 'inputText',
    type: 'string',
    typeOptions: { rows: 6 },
    default: '',
    displayOptions: { show: { resource: ['extraction'], operation: ['run'] } },
  },
  {
    displayName: 'Use Binary Images',
    name: 'useBinaryImages',
    type: 'boolean',
    default: false,
    description: 'Read images from binary properties on the input item (vision extraction)',
    displayOptions: { show: { resource: ['extraction'], operation: ['run'] } },
  },
  {
    displayName: 'Binary Properties',
    name: 'binaryProperties',
    type: 'string',
    default: 'data',
    description: 'Comma-separated list of binary property names (max 10)',
    displayOptions: {
      show: { resource: ['extraction'], operation: ['run'], useBinaryImages: [true] },
    },
  },
  {
    displayName: 'Wait For Completion',
    name: 'waitForCompletion',
    type: 'boolean',
    default: true,
    description:
      'Submit asynchronously and poll until the extraction completes. Recommended for documents that take longer than ~30 seconds.',
    displayOptions: { show: { resource: ['extraction'], operation: ['run'] } },
  },
  {
    displayName: 'Poll Interval (S)',
    name: 'pollIntervalSec',
    type: 'number',
    default: 2,
    description: 'How often to poll the extraction status (seconds)',
    displayOptions: {
      show: { resource: ['extraction'], operation: ['run'], waitForCompletion: [true] },
    },
  },
  {
    displayName: 'Poll Timeout (S)',
    name: 'pollTimeoutSec',
    type: 'number',
    default: 600,
    description: 'Maximum time to wait for completion (seconds). Default: 600 (10 min).',
    displayOptions: {
      show: { resource: ['extraction'], operation: ['run'], waitForCompletion: [true] },
    },
  },
  // Get op fields
  {
    displayName: 'Extraction ID',
    name: 'extractionId',
    type: 'string',
    required: true,
    default: '',
    displayOptions: { show: { resource: ['extraction'], operation: ['get'] } },
    description: 'ID of the extraction to retrieve',
  },
  // Estimate op fields
  schemaResourceLocator(['estimate']),
  schemaVersionResourceLocator(['estimate']),
  {
    displayName: 'Input Text',
    name: 'estimateInputText',
    type: 'string',
    typeOptions: { rows: 6 },
    required: true,
    default: '',
    displayOptions: { show: { resource: ['extraction'], operation: ['estimate'] } },
  },
];
