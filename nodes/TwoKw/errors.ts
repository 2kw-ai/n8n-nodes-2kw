import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import type { INode, JsonObject } from 'n8n-workflow';

/**
 * Normalises anything thrown out of a resource handler into an n8n node error.
 *
 * `execute()` cannot simply re-throw what it caught: raw errors lose their HTTP
 * context in the n8n UI, and `@n8n/community-nodes/require-node-api-error`
 * rejects the package for it (#363). It cannot blindly wrap either — the
 * operations throw `NodeOperationError` with messages written for the user
 * ("Maximum 10 binary images per extraction"), and burying those inside a
 * `NodeApiError` would replace them with an HTTP-shaped default.
 *
 * So: pass through what is already a node error, wrap what is not.
 */
export function toNodeError(node: INode, error: unknown, itemIndex: number): Error {
  if (error instanceof NodeApiError || error instanceof NodeOperationError) {
    return error;
  }

  return new NodeApiError(node, error as JsonObject, { itemIndex });
}
