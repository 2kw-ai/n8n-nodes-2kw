import { INodeProperties } from 'n8n-workflow';

export const documentOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: { show: { resource: ['document'] } },
  default: 'convert',
  options: [
    {
      name: 'Convert',
      value: 'convert',
      description: 'Convert a document (PDF, DOCX, XLSX, etc.) to markdown',
      action: 'Convert a document',
    },
    {
      name: 'Convert From Source',
      value: 'convertSource',
      description: 'Convert a document from a URL or base64 string (no binary upload)',
      action: 'Convert from source',
    },
  ],
};

export const documentFields: INodeProperties[] = [
  {
    displayName: 'Binary Property Name',
    name: 'binaryPropertyName',
    type: 'string',
    required: true,
    default: 'data',
    description: 'Name of the binary property on the input item to upload',
    displayOptions: { show: { resource: ['document'], operation: ['convert'] } },
  },
  {
    displayName: 'Source Type',
    name: 'sourceType',
    type: 'options',
    default: 'url',
    options: [
      { name: 'URL', value: 'url' },
      { name: 'Base64', value: 'base64' },
    ],
    displayOptions: { show: { resource: ['document'], operation: ['convertSource'] } },
  },
  {
    displayName: 'URL',
    name: 'sourceUrl',
    type: 'string',
    default: '',
    required: true,
    displayOptions: {
      show: { resource: ['document'], operation: ['convertSource'], sourceType: ['url'] },
    },
  },
  {
    displayName: 'Headers',
    name: 'sourceHeaders',
    type: 'json',
    default: '{}',
    description: 'Optional HTTP headers (JSON object)',
    displayOptions: {
      show: { resource: ['document'], operation: ['convertSource'], sourceType: ['url'] },
    },
  },
  {
    displayName: 'Data (Base64)',
    name: 'sourceData',
    type: 'string',
    default: '',
    required: true,
    description: 'Base64-encoded file contents',
    displayOptions: {
      show: { resource: ['document'], operation: ['convertSource'], sourceType: ['base64'] },
    },
  },
  {
    displayName: 'MIME Type',
    name: 'sourceMimeType',
    type: 'string',
    default: 'application/pdf',
    required: true,
    displayOptions: {
      show: { resource: ['document'], operation: ['convertSource'], sourceType: ['base64'] },
    },
  },
  {
    displayName: 'Filename',
    name: 'sourceFilename',
    type: 'string',
    default: 'document',
    required: true,
    displayOptions: {
      show: { resource: ['document'], operation: ['convertSource'], sourceType: ['base64'] },
    },
  },
  {
    displayName: 'Pipeline',
    name: 'pipeline',
    type: 'options',
    default: 'fast',
    options: [
      { name: 'Fast', value: 'fast' },
      { name: 'OCR', value: 'ocr' },
      { name: 'VLM', value: 'vlm' },
    ],
    description:
      'Fast for text-heavy files, OCR for scans, VLM for image-heavy or complex layouts',
    displayOptions: { show: { resource: ['document'], operation: ['convertSource'] } },
  },
  {
    displayName: 'Output Formats',
    name: 'outputFormats',
    type: 'multiOptions',
    default: ['MD'],
    description: 'Which content representations to include on each document item',
    options: [
      { name: 'Markdown', value: 'MD' },
      { name: 'Plain Text', value: 'TEXT' },
      { name: 'JSON', value: 'JSON' },
      { name: 'HTML', value: 'HTML' },
    ],
    displayOptions: {
      show: { resource: ['document'], operation: ['convert', 'convertSource'] },
    },
  },
];
