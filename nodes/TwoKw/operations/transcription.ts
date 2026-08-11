import {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  NodeOperationError,
} from 'n8n-workflow';
import { apiRequest } from '../transport';

export async function executeTranscription(
  this: IExecuteFunctions,
  itemIndex: number,
  operation: string,
): Promise<INodeExecutionData[]> {
  if (operation !== 'transcribe') {
    throw new NodeOperationError(
      this.getNode(),
      `Unknown transcription operation: ${operation}`,
      { itemIndex },
    );
  }

  const propertyName = this.getNodeParameter('binaryPropertyName', itemIndex) as string;
  const model = this.getNodeParameter('model', itemIndex) as string;
  const language = (this.getNodeParameter('language', itemIndex) as string) || '';
  const prompt = (this.getNodeParameter('prompt', itemIndex) as string) || '';
  const responseFormat = (this.getNodeParameter('responseFormat', itemIndex) as string) || '';
  const temperature = (this.getNodeParameter('temperature', itemIndex) as string) || '';

  const item = this.getInputData()[itemIndex];
  const binaryEntry = item.binary?.[propertyName];
  if (!binaryEntry) {
    throw new NodeOperationError(
      this.getNode(),
      `Binary property "${propertyName}" not found on input item`,
      { itemIndex },
    );
  }
  const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, propertyName);

  const formData: Record<string, unknown> = { model };
  if (language) formData.language = language;
  if (prompt) formData.prompt = prompt;
  if (responseFormat) formData.response_format = responseFormat;
  if (temperature) formData.temperature = temperature;

  const result = await apiRequest(this, 'POST', '/v1/audio/transcriptions', {
    formData,
    binary: {
      fieldName: 'file',
      buffer,
      filename: binaryEntry.fileName ?? 'audio',
      mimeType: binaryEntry.mimeType ?? 'application/octet-stream',
    },
  });

  return [{ json: result as IDataObject, pairedItem: itemIndex }];
}
