import {
  IExecuteFunctions,
  IHttpRequestOptions,
  JsonObject,
  NodeApiError,
} from 'n8n-workflow';
import type { paths } from '../../generated/openapi';

export type ApiPaths = paths;

export interface ApiRequestOptions {
  pathParams?: Record<string, string>;
  query?: Record<string, string | string[] | number | boolean | undefined>;
  body?: unknown;
  formData?: Record<string, unknown>;
  binary?: { fieldName: string; buffer: Buffer; filename: string; mimeType: string };
}

export async function apiRequest<T = unknown>(
  ctx: IExecuteFunctions,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  opts: ApiRequestOptions = {},
): Promise<T> {
  const credentials = await ctx.getCredentials('2kwApi');
  const baseUrl = String(credentials.baseUrl).replace(/\/+$/, '');

  let resolvedPath = path;
  if (opts.pathParams) {
    for (const [k, v] of Object.entries(opts.pathParams)) {
      resolvedPath = resolvedPath.replace(`{${k}}`, encodeURIComponent(v));
    }
  }

  const requestOptions: IHttpRequestOptions = {
    method,
    url: `${baseUrl}${resolvedPath}`,
    qs: opts.query,
    json: true,
  };

  if (opts.body !== undefined) {
    requestOptions.body = opts.body;
  }

  if (opts.formData || opts.binary) {
    requestOptions.json = false;
    const form: Record<string, unknown> = { ...(opts.formData ?? {}) };
    if (opts.binary) {
      form[opts.binary.fieldName] = {
        value: opts.binary.buffer,
        options: { filename: opts.binary.filename, contentType: opts.binary.mimeType },
      };
    }
    (requestOptions as IHttpRequestOptions & { formData?: unknown }).formData = form;
  }

  try {
    return (await ctx.helpers.httpRequestWithAuthentication.call(
      ctx,
      '2kwApi',
      requestOptions,
    )) as T;
  } catch (error) {
    throw new NodeApiError(ctx.getNode(), error as JsonObject);
  }
}

export function extractResourceId(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'value' in value) {
    const v = (value as { value?: unknown }).value;
    return typeof v === 'string' ? v : '';
  }
  return '';
}
