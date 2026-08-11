import {
  IExecuteFunctions,
  INodeExecutionData,
  NodeOperationError,
} from 'n8n-workflow';
import { apiRequest } from '../transport';
import { splitConvertResponse } from '../splitConvert';

export async function executeDocument(
  this: IExecuteFunctions,
  itemIndex: number,
  operation: string,
): Promise<INodeExecutionData[]> {
  if (operation === 'convertSource') {
    const sourceType = this.getNodeParameter('sourceType', itemIndex) as string;
    const pipeline = this.getNodeParameter('pipeline', itemIndex) as string;
    const outputFormats = this.getNodeParameter('outputFormats', itemIndex) as string[];

    let source: Record<string, unknown>;
    if (sourceType === 'url') {
      const url = this.getNodeParameter('sourceUrl', itemIndex) as string;
      const rawHeaders = this.getNodeParameter('sourceHeaders', itemIndex);
      const headers: Record<string, string> =
        typeof rawHeaders === 'string'
          ? JSON.parse(rawHeaders || '{}')
          : (rawHeaders as Record<string, string>);
      source = { kind: 'http', url };
      if (Object.keys(headers).length > 0) source.headers = headers;
    } else {
      source = {
        kind: 'base64',
        content: this.getNodeParameter('sourceData', itemIndex) as string,
        mimeType: this.getNodeParameter('sourceMimeType', itemIndex) as string,
        filename: this.getNodeParameter('sourceFilename', itemIndex) as string,
      };
    }

    const response = (await apiRequest(this, 'POST', '/v1/convert/source', {
      body: {
        sources: [source],
        options: { pipeline, options: { outputFormats } },
      },
    })) as Parameters<typeof splitConvertResponse>[0];

    return splitConvertResponse(response, itemIndex);
  }

  if (operation !== 'convert') {
    throw new NodeOperationError(this.getNode(), `Unknown document operation: ${operation}`, {
      itemIndex,
    });
  }

  // Convert (multipart) op
  const propertyName = this.getNodeParameter('binaryPropertyName', itemIndex) as string;
  const outputFormats = this.getNodeParameter('outputFormats', itemIndex) as string[];
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

  const response = (await apiRequest(this, 'POST', '/v1/convert/file', {
    formData: { options: JSON.stringify({ options: { outputFormats } }) },
    binary: {
      fieldName: 'files',
      buffer,
      filename: binaryEntry.fileName ?? 'document',
      mimeType: binaryEntry.mimeType ?? 'application/octet-stream',
    },
  })) as Parameters<typeof splitConvertResponse>[0];

  return splitConvertResponse(response, itemIndex);
}
