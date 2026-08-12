import { INodeProperties } from 'n8n-workflow';

export const transcriptionOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: { show: { resource: ['transcription'] } },
  default: 'transcribe',
  options: [
    {
      name: 'Transcribe',
      value: 'transcribe',
      description: 'Transcribe audio to text',
      action: 'Transcribe audio',
    },
  ],
};

export const transcriptionFields: INodeProperties[] = [
  {
    displayName: 'Binary Property Name',
    name: 'binaryPropertyName',
    type: 'string',
    required: true,
    default: 'data',
    displayOptions: { show: { resource: ['transcription'], operation: ['transcribe'] } },
  },
  {
    displayName: 'Model',
    name: 'model',
    type: 'string',
    required: true,
    default: 'openai/whisper-1',
    displayOptions: { show: { resource: ['transcription'], operation: ['transcribe'] } },
  },
  {
    displayName: 'Language',
    name: 'language',
    type: 'string',
    default: '',
    description: 'ISO-639-1 code (e.g. en, de). Optional.',
    displayOptions: { show: { resource: ['transcription'], operation: ['transcribe'] } },
  },
  {
    displayName: 'Prompt',
    name: 'prompt',
    type: 'string',
    default: '',
    description: 'Optional context text to bias transcription',
    displayOptions: { show: { resource: ['transcription'], operation: ['transcribe'] } },
  },
  {
    displayName: 'Response Format',
    name: 'responseFormat',
    type: 'options',
    default: 'json',
    options: [
      { name: 'JSON', value: 'json' },
      { name: 'SRT', value: 'srt' },
      { name: 'Text', value: 'text' },
      { name: 'Verbose JSON', value: 'verbose_json' },
      { name: 'VTT', value: 'vtt' },
    ],
    displayOptions: { show: { resource: ['transcription'], operation: ['transcribe'] } },
  },
  {
    displayName: 'Temperature',
    name: 'temperature',
    type: 'string',
    default: '',
    description: 'Optional sampling temperature (0–1)',
    displayOptions: { show: { resource: ['transcription'], operation: ['transcribe'] } },
  },
];
