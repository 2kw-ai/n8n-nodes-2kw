import {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  NodeOperationError,
} from 'n8n-workflow';
import { apiRequest, extractResourceId } from '../transport';

export async function executeSchema(
  this: IExecuteFunctions,
  itemIndex: number,
  operation: string,
): Promise<INodeExecutionData[]> {
  if (operation === 'get') {
    const schemaId = extractResourceId(this.getNodeParameter('schema', itemIndex));
    const result = await apiRequest(this, 'GET', '/v1/schemas/{id}', {
      pathParams: { id: schemaId },
    });
    return [{ json: result as IDataObject, pairedItem: itemIndex }];
  }

  throw new NodeOperationError(this.getNode(), `Unknown schema operation: ${operation}`, {
    itemIndex,
  });
}
