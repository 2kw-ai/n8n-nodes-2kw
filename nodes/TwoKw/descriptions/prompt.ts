import { INodeProperties } from 'n8n-workflow';

export const promptOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: { show: { resource: ['prompt'] } },
  default: 'get',
  options: [
    { name: 'Get', value: 'get', description: 'Retrieve prompt metadata', action: 'Get a prompt' },
    {
      name: 'Compile',
      value: 'compile',
      description: 'Compile a prompt with variables',
      action: 'Compile a prompt',
    },
    {
      name: 'Resolve',
      value: 'resolve',
      description: 'Get the active prompt content (no variable interpolation)',
      action: 'Resolve a prompt',
    },
  ],
};

const promptResourceLocator: INodeProperties = {
  displayName: 'Prompt',
  name: 'prompt',
  type: 'resourceLocator',
  default: { mode: 'list', value: '' },
  required: true,
  displayOptions: { show: { resource: ['prompt'] } },
  description: 'Pick from a list or paste a prompt ID',
  modes: [
    {
      displayName: 'From List',
      name: 'list',
      type: 'list',
      typeOptions: { searchListMethod: 'searchPrompts', searchable: true },
    },
    {
      displayName: 'By ID',
      name: 'id',
      type: 'string',
      placeholder: 'e041c4fa-7dcc-4db5-b5b3-c104285b73c9',
    },
  ],
};

export const promptFields: INodeProperties[] = [
  promptResourceLocator,
  {
    displayName: 'Variables',
    name: 'variables',
    type: 'json',
    default: '{}',
    displayOptions: { show: { resource: ['prompt'], operation: ['compile'] } },
    description: 'JSON object of variables to interpolate into the prompt template',
  },
  {
    displayName: 'Version ID',
    name: 'versionId',
    type: 'string',
    default: '',
    description: 'Optional. Pin to a specific version. Mutually exclusive with Label.',
    displayOptions: { show: { resource: ['prompt'], operation: ['compile'] } },
  },
  {
    displayName: 'Label',
    name: 'label',
    type: 'resourceLocator',
    default: { mode: 'list', value: '' },
    description: 'Optional. Compile the version associated with this label (e.g. "prod"). Mutually exclusive with Version ID.',
    displayOptions: { show: { resource: ['prompt'], operation: ['compile'] } },
    modes: [
      {
        displayName: 'From List',
        name: 'list',
        type: 'list',
        typeOptions: { searchListMethod: 'searchPromptLabels', searchable: false },
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
    displayName: 'Label',
    name: 'resolveLabel',
    type: 'resourceLocator',
    default: { mode: 'list', value: '' },
    description: 'Optional. Pin to a specific labelled version. Leave empty for the active version.',
    displayOptions: { show: { resource: ['prompt'], operation: ['resolve'] } },
    modes: [
      {
        displayName: 'From List',
        name: 'list',
        type: 'list',
        typeOptions: { searchListMethod: 'searchPromptLabels', searchable: false },
      },
      {
        displayName: 'By Name',
        name: 'id',
        type: 'string',
        placeholder: 'prod',
      },
    ],
  },
];
