import {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  NodeOperationError,
} from 'n8n-workflow';
import { apiRequest, extractResourceId } from '../transport';

export async function executePrompt(
  this: IExecuteFunctions,
  itemIndex: number,
  operation: string,
): Promise<INodeExecutionData[]> {
  if (operation === 'get') {
    const promptId = extractResourceId(this.getNodeParameter('prompt', itemIndex));
    const result = await apiRequest(this, 'GET', '/v1/prompts/{id}', {
      pathParams: { id: promptId },
    });
    return [{ json: result as IDataObject, pairedItem: itemIndex }];
  }

  if (operation === 'compile') {
    const promptId = extractResourceId(this.getNodeParameter('prompt', itemIndex));
    const rawVariables = this.getNodeParameter('variables', itemIndex);
    const variables: Record<string, unknown> =
      typeof rawVariables === 'string'
        ? JSON.parse(rawVariables)
        : (rawVariables as Record<string, unknown>);
    const versionId = (this.getNodeParameter('versionId', itemIndex) as string) || '';
    const label = extractResourceId(this.getNodeParameter('label', itemIndex));

    const body: Record<string, unknown> = { variables };
    if (versionId) body.versionId = versionId;
    if (label) body.label = label;

    const result = await apiRequest(this, 'POST', '/v1/prompts/{promptId}/compile', {
      pathParams: { promptId },
      body,
    });
    return [{ json: result as IDataObject, pairedItem: itemIndex }];
  }

  if (operation === 'resolve') {
    const promptId = extractResourceId(this.getNodeParameter('prompt', itemIndex));
    const label = extractResourceId(this.getNodeParameter('resolveLabel', itemIndex));
    const opts: { pathParams: Record<string, string>; query?: Record<string, string> } = {
      pathParams: { promptId },
    };
    if (label) opts.query = { label };

    const result = await apiRequest(this, 'GET', '/v1/prompts/{promptId}/resolve', opts);
    return [{ json: result as IDataObject, pairedItem: itemIndex }];
  }

  throw new NodeOperationError(this.getNode(), `Unknown prompt operation: ${operation}`, {
    itemIndex,
  });
}
