import { INodeProperties } from 'n8n-workflow';
import { schemaOperations, schemaFields } from './schema';
import { promptOperations, promptFields } from './prompt';
import { extractionOperations, extractionFields } from './extraction';
import { documentOperations, documentFields } from './document';
import { transcriptionOperations, transcriptionFields } from './transcription';

export const resourceField: INodeProperties = {
  displayName: 'Resource',
  name: 'resource',
  type: 'options',
  noDataExpression: true,
  default: 'schema',
  // Alphabetical, not workflow order: n8n's community-node scan enforces
  // `node-param-options-type-unsorted-items` (#363).
  options: [
    { name: 'Document', value: 'document' },
    { name: 'Extraction', value: 'extraction' },
    { name: 'Prompt', value: 'prompt' },
    { name: 'Schema', value: 'schema' },
    { name: 'Transcription', value: 'transcription' },
  ],
};

export const resourceProperties: INodeProperties[] = [
  schemaOperations,
  ...schemaFields,
  promptOperations,
  ...promptFields,
  extractionOperations,
  ...extractionFields,
  documentOperations,
  ...documentFields,
  transcriptionOperations,
  ...transcriptionFields,
];
