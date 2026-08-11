import { describe, it, expect, vi } from 'vitest';
import { methods } from '../methods';

function makeCtx(opts: {
  listResponse: unknown;
  parentParam?: { name: string; value: unknown };
}) {
  const fn = vi.fn().mockResolvedValue(opts.listResponse);
  const ctx: any = {
    helpers: { httpRequestWithAuthentication: fn.bind({}) },
    getCredentials: vi.fn().mockResolvedValue({ baseUrl: 'https://api.2kw.ai', apiKey: 'k' }),
    getCurrentNodeParameter: vi.fn((name: string) =>
      opts.parentParam && opts.parentParam.name === name ? opts.parentParam.value : undefined,
    ),
    getNodeParameter: vi.fn((name: string) =>
      opts.parentParam && opts.parentParam.name === name ? opts.parentParam.value : undefined,
    ),
    getNode: vi.fn().mockReturnValue({ name: '2kw' }),
  };
  return { ctx, fn };
}

describe('methods.listSearch', () => {
  it('searchSchemas: GETs /v1/schemas with search param and maps to results', async () => {
    const { ctx, fn } = makeCtx({
      listResponse: {
        content: [
          { id: 'sch-1', name: 'Invoice' },
          { id: 'sch-2', name: 'Order' },
        ],
      },
    });
    const result = await methods.listSearch.searchSchemas.call(ctx, 'inv');
    expect(fn.mock.calls[0][1].url).toBe('https://api.2kw.ai/v1/schemas');
    expect(fn.mock.calls[0][1].qs).toEqual({ search: 'inv', page: 0, size: 100 });
    expect(result).toEqual({
      results: [
        { name: 'Invoice', value: 'sch-1' },
        { name: 'Order', value: 'sch-2' },
      ],
    });
  });

  it('searchSchemas: omits search query when filter is empty', async () => {
    const { ctx, fn } = makeCtx({ listResponse: { content: [] } });
    await methods.listSearch.searchSchemas.call(ctx, '');
    expect(fn.mock.calls[0][1].qs).toEqual({ page: 0, size: 100 });
  });

  it('searchPrompts: GETs /v1/prompts with search and maps results', async () => {
    const { ctx, fn } = makeCtx({
      listResponse: {
        content: [{ id: 'p-1', name: 'Greeting' }],
      },
    });
    const result = await methods.listSearch.searchPrompts.call(ctx, 'gr');
    expect(fn.mock.calls[0][1].url).toBe('https://api.2kw.ai/v1/prompts');
    expect(fn.mock.calls[0][1].qs).toEqual({ search: 'gr', page: 0, size: 100 });
    expect(result.results).toEqual([{ name: 'Greeting', value: 'p-1' }]);
  });

  it('searchSchemaVersions: requires schema parent; reads via getCurrentNodeParameter', async () => {
    const { ctx, fn } = makeCtx({
      listResponse: {
        content: [
          { id: 'v-1', versionNumber: 1, changeDescription: 'initial', isActive: false },
          { id: 'v-2', versionNumber: 2, changeDescription: 'cleanup', isActive: true },
        ],
      },
      parentParam: { name: 'schema', value: { mode: 'list', value: 'sch-9' } },
    });
    const result = await methods.listSearch.searchSchemaVersions.call(ctx);
    expect(fn.mock.calls[0][1].url).toBe('https://api.2kw.ai/v1/schemas/sch-9/versions');
    expect(result.results).toEqual([
      { name: 'v1 — initial', value: 'v-1' },
      { name: 'v2 (active) — cleanup', value: 'v-2' },
    ]);
  });

  it('searchSchemaVersions: returns empty when parent schema is not selected', async () => {
    const { ctx, fn } = makeCtx({ listResponse: {} });
    const result = await methods.listSearch.searchSchemaVersions.call(ctx);
    expect(fn).not.toHaveBeenCalled();
    expect(result).toEqual({ results: [] });
  });

  it('searchSchemaLabels: resolves labels to versionIds and labels with v# suffix', async () => {
    const { ctx, fn } = makeCtx({
      listResponse: [
        { name: 'prod', schemaVersionId: 'v-9', versionNumber: 9 },
        { name: 'staging', schemaVersionId: 'v-8', versionNumber: 8 },
      ],
      parentParam: { name: 'schema', value: 'sch-1' },
    });
    const result = await methods.listSearch.searchSchemaLabels.call(ctx);
    expect(fn.mock.calls[0][1].url).toBe('https://api.2kw.ai/v1/schemas/sch-1/labels');
    expect(result.results).toEqual([
      { name: 'prod (v9)', value: 'v-9' },
      { name: 'staging (v8)', value: 'v-8' },
    ]);
  });

  it('searchSchemaLabels: drops entries without a schemaVersionId', async () => {
    const { ctx } = makeCtx({
      listResponse: [
        { name: 'orphan' },
        { name: 'prod', schemaVersionId: 'v-9', versionNumber: 9 },
      ],
      parentParam: { name: 'schema', value: 'sch-1' },
    });
    const result = await methods.listSearch.searchSchemaLabels.call(ctx);
    expect(result.results).toEqual([{ name: 'prod (v9)', value: 'v-9' }]);
  });

  it('searchPromptVersions: depends on prompt parent', async () => {
    const { ctx, fn } = makeCtx({
      listResponse: { content: [{ id: 'pv-1', versionNumber: 1, isActive: true }] },
      parentParam: { name: 'prompt', value: { mode: 'list', value: 'p-7' } },
    });
    const result = await methods.listSearch.searchPromptVersions.call(ctx);
    expect(fn.mock.calls[0][1].url).toBe('https://api.2kw.ai/v1/prompts/p-7/versions');
    expect(result.results).toEqual([{ name: 'v1 (active)', value: 'pv-1' }]);
  });

  it('searchPromptLabels: depends on prompt parent', async () => {
    const { ctx, fn } = makeCtx({
      listResponse: [{ name: 'prod', versionId: 'pv-1' }],
      parentParam: { name: 'prompt', value: 'p-7' },
    });
    const result = await methods.listSearch.searchPromptLabels.call(ctx);
    expect(fn.mock.calls[0][1].url).toBe('https://api.2kw.ai/v1/prompts/p-7/labels');
    expect(result.results).toEqual([{ name: 'prod', value: 'prod' }]);
  });
});
