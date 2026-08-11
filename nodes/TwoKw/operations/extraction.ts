import {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  NodeOperationError,
} from 'n8n-workflow';
import { apiRequest, extractResourceId } from '../transport';
import { pollUntilTerminal } from '../polling';

interface InputImage {
  data: string;
  mimeType: string;
}

export async function executeExtraction(
  this: IExecuteFunctions,
  itemIndex: number,
  operation: string,
): Promise<INodeExecutionData[]> {
  if (operation === 'get') {
    const extractionId = this.getNodeParameter('extractionId', itemIndex) as string;
    const result = await apiRequest(this, 'GET', '/v1/extractions/{id}', {
      pathParams: { id: extractionId },
    });
    return [{ json: result as IDataObject, pairedItem: itemIndex }];
  }

  if (operation === 'estimate') {
    const schemaId = extractResourceId(this.getNodeParameter('schema', itemIndex));
    const schemaVersionId = extractResourceId(this.getNodeParameter('schemaVersion', itemIndex));
    const inputText = this.getNodeParameter('estimateInputText', itemIndex) as string;

    const body: Record<string, unknown> = { schemaId, inputText };
    if (schemaVersionId) body.schemaVersionId = schemaVersionId;

    const result = await apiRequest(this, 'POST', '/v1/extractions/estimate', { body });
    return [{ json: result as IDataObject, pairedItem: itemIndex }];
  }

  if (operation !== 'run') {
    throw new NodeOperationError(this.getNode(), `Unknown extraction operation: ${operation}`, {
      itemIndex,
    });
  }

  // run path
  const schemaId = extractResourceId(this.getNodeParameter('schema', itemIndex));
  const schemaVersionId = extractResourceId(this.getNodeParameter('schemaVersion', itemIndex));
  const model = this.getNodeParameter('model', itemIndex) as string;
  const inputText = this.getNodeParameter('inputText', itemIndex) as string;
  const useBinaryImages = this.getNodeParameter('useBinaryImages', itemIndex) as boolean;
  const waitForCompletion = this.getNodeParameter('waitForCompletion', itemIndex) as boolean;

  const inputImages: InputImage[] = [];
  if (useBinaryImages) {
    const binaryProperties = ((this.getNodeParameter('binaryProperties', itemIndex) as string) || '')
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (binaryProperties.length > 10) {
      throw new NodeOperationError(this.getNode(), 'Maximum 10 binary images per extraction', {
        itemIndex,
      });
    }
    const item = this.getInputData()[itemIndex];
    for (const propertyName of binaryProperties) {
      const binaryEntry = item.binary?.[propertyName];
      if (!binaryEntry) {
        throw new NodeOperationError(
          this.getNode(),
          `Binary property "${propertyName}" not found on input item`,
          { itemIndex },
        );
      }
      const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, propertyName);
      inputImages.push({ data: buffer.toString('base64'), mimeType: binaryEntry.mimeType });
    }
  }

  if (!inputText && inputImages.length === 0) {
    throw new NodeOperationError(
      this.getNode(),
      'Provide inputText or images for extraction',
      { itemIndex },
    );
  }

  const body: Record<string, unknown> = { schemaId, model };
  if (schemaVersionId) body.schemaVersionId = schemaVersionId;
  if (inputText) body.inputText = inputText;
  if (inputImages.length > 0) body.inputImages = inputImages;

  if (!waitForCompletion) {
    // Sync path — exact v1 behaviour.
    const result = await apiRequest(this, 'POST', '/v1/extractions', { body });
    return [{ json: result as IDataObject, pairedItem: itemIndex }];
  }

  // Async + poll path.
  const pollIntervalSec = this.getNodeParameter('pollIntervalSec', itemIndex) as number;
  const pollTimeoutSec = this.getNodeParameter('pollTimeoutSec', itemIndex) as number;

  const submitted = (await apiRequest(this, 'POST', '/v1/extractions/async', { body })) as {
    id: string;
    status?: string;
  };
  if (!submitted.id) {
    throw new NodeOperationError(
      this.getNode(),
      'Async extraction submission did not return an id',
      { itemIndex },
    );
  }

  const final = await pollUntilTerminal(
    () =>
      apiRequest<{ status?: string; id: string }>(this, 'GET', '/v1/extractions/{id}', {
        pathParams: { id: submitted.id },
      }),
    {
      intervalMs: Math.max(1, Math.floor(pollIntervalSec * 1000)),
      timeoutMs: Math.max(1, Math.floor(pollTimeoutSec * 1000)),
      terminalStatuses: ['COMPLETED', 'FAILED'],
    },
  );

  if (final.status === 'FAILED') {
    throw new NodeOperationError(
      this.getNode(),
      `Extraction failed: ${JSON.stringify(final)}`,
      { itemIndex },
    );
  }

  return [{ json: final as IDataObject, pairedItem: itemIndex }];
}
