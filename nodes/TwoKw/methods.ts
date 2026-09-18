import { IDataObject, ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';
import { extractResourceId } from './transport';

interface CredentialsShape {
  baseUrl: string;
  apiKey: string;
}

async function backboneGet(
  ctx: ILoadOptionsFunctions,
  path: string,
  query?: IDataObject,
): Promise<unknown> {
  const credentials = (await ctx.getCredentials('2kwApi')) as unknown as CredentialsShape;
  const baseUrl = String(credentials.baseUrl).replace(/\/+$/, '');
  return ctx.helpers.httpRequestWithAuthentication.call(ctx, '2kwApi', {
    method: 'GET',
    url: `${baseUrl}${path}`,
    qs: query,
    json: true,
  });
}

function pageQuery(filter?: string): IDataObject {
  const q: IDataObject = { page: 0, size: 100 };
  if (filter && filter.length > 0) q.search = filter;
  return q;
}

function readParentId(ctx: ILoadOptionsFunctions, name: string): string {
  return extractResourceId(ctx.getCurrentNodeParameter(name));
}

function formatVersion(v: {
  versionNumber?: number;
  changeDescription?: string;
  isActive?: boolean;
}): string {
  const num = typeof v.versionNumber === 'number' ? `v${v.versionNumber}` : 'v?';
  const active = v.isActive ? ' (active)' : '';
  const desc = v.changeDescription ? ` — ${v.changeDescription}` : '';
  return `${num}${active}${desc}`;
}

export const methods = {
  listSearch: {
    async searchSchemas(
      this: ILoadOptionsFunctions,
      filter?: string,
    ): Promise<INodeListSearchResult> {
      const data = (await backboneGet(this, '/v1/schemas', pageQuery(filter))) as {
        content?: { id: string; name: string }[];
      };
      return {
        results: (data.content ?? []).map((s) => ({ name: s.name, value: s.id })),
      };
    },

    async searchPrompts(
      this: ILoadOptionsFunctions,
      filter?: string,
    ): Promise<INodeListSearchResult> {
      const data = (await backboneGet(this, '/v1/prompts', pageQuery(filter))) as {
        content?: { id: string; name: string }[];
      };
      return {
        results: (data.content ?? []).map((p) => ({ name: p.name, value: p.id })),
      };
    },

    async searchSchemaVersions(this: ILoadOptionsFunctions): Promise<INodeListSearchResult> {
      const schemaId = readParentId(this, 'schema');
      if (!schemaId) return { results: [] };
      const data = (await backboneGet(
        this,
        `/v1/schemas/${encodeURIComponent(schemaId)}/versions`,
        {
          page: 0,
          size: 100,
        },
      )) as {
        content?: {
          id: string;
          versionNumber?: number;
          changeDescription?: string;
          isActive?: boolean;
        }[];
      };
      return {
        results: (data.content ?? []).map((v) => ({ name: formatVersion(v), value: v.id })),
      };
    },

    async searchSchemaLabels(this: ILoadOptionsFunctions): Promise<INodeListSearchResult> {
      const schemaId = readParentId(this, 'schema');
      if (!schemaId) return { results: [] };
      const data = (await backboneGet(
        this,
        `/v1/schemas/${encodeURIComponent(schemaId)}/labels`,
      )) as {
        name: string;
        schemaVersionId?: string;
        versionNumber?: number;
      }[];
      return {
        results: (data ?? [])
          .filter((l) => !!l.schemaVersionId)
          .map((l) => ({
            name:
              typeof l.versionNumber === 'number'
                ? `${l.name} (v${l.versionNumber})`
                : l.name,
            value: l.schemaVersionId as string,
          })),
      };
    },

    async searchPromptVersions(this: ILoadOptionsFunctions): Promise<INodeListSearchResult> {
      const promptId = readParentId(this, 'prompt');
      if (!promptId) return { results: [] };
      const data = (await backboneGet(
        this,
        `/v1/prompts/${encodeURIComponent(promptId)}/versions`,
        {
          page: 0,
          size: 100,
        },
      )) as {
        content?: {
          id: string;
          versionNumber?: number;
          changeDescription?: string;
          isActive?: boolean;
        }[];
      };
      return {
        results: (data.content ?? []).map((v) => ({ name: formatVersion(v), value: v.id })),
      };
    },

    async searchPromptLabels(this: ILoadOptionsFunctions): Promise<INodeListSearchResult> {
      const promptId = readParentId(this, 'prompt');
      if (!promptId) return { results: [] };
      const data = (await backboneGet(
        this,
        `/v1/prompts/${encodeURIComponent(promptId)}/labels`,
      )) as {
        name: string;
      }[];
      return {
        results: (data ?? []).map((l) => ({ name: l.name, value: l.name })),
      };
    },
  },
};
