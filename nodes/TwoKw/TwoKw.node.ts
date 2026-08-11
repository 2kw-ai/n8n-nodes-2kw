import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeConnectionType,
  NodeOperationError,
} from 'n8n-workflow';
import { resourceField, resourceProperties } from './descriptions';
import { methods } from './methods';
import { executeSchema } from './operations/schema';
import { executePrompt } from './operations/prompt';
import { executeExtraction } from './operations/extraction';
import { executeDocument } from './operations/document';
import { executeTranscription } from './operations/transcription';

type ResourceHandler = (
  this: IExecuteFunctions,
  itemIndex: number,
  operation: string,
) => Promise<INodeExecutionData[]>;

const resourceHandlers: Record<string, ResourceHandler> = {};

export function registerResource(name: string, handler: ResourceHandler): void {
  resourceHandlers[name] = handler;
}

export class TwoKw implements INodeType {
  description: INodeTypeDescription = {
    displayName: '2kw',
    name: 'twoKw',
    icon: 'file:icon.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Use 2kw.ai (Backbone) for AI extraction, prompts, and more',
    defaults: { name: '2kw' },
    inputs: ['main' as NodeConnectionType],
    outputs: ['main' as NodeConnectionType],
    credentials: [{ name: '2kwApi', required: true }],
    properties: [resourceField, ...resourceProperties],
  };

  methods = methods as unknown as INodeType['methods'];

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const resource = this.getNodeParameter('resource', i) as string;
        const operation = this.getNodeParameter('operation', i) as string;

        const handler = resourceHandlers[resource];
        if (!handler) {
          throw new NodeOperationError(this.getNode(), `Unknown resource: ${resource}`, {
            itemIndex: i,
          });
        }

        const result = await handler.call(this, i, operation);
        returnData.push(...result);
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: (error as Error).message }, pairedItem: i });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}

registerResource('schema', async function (itemIndex, operation) {
  return executeSchema.call(this, itemIndex, operation);
});

registerResource('prompt', async function (itemIndex, operation) {
  return executePrompt.call(this, itemIndex, operation);
});

registerResource('extraction', async function (itemIndex, operation) {
  return executeExtraction.call(this, itemIndex, operation);
});

registerResource('document', async function (itemIndex, operation) {
  return executeDocument.call(this, itemIndex, operation);
});

registerResource('transcription', async function (itemIndex, operation) {
  return executeTranscription.call(this, itemIndex, operation);
});
