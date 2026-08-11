import { describe, it, expect, vi } from 'vitest';
import { executePrompt } from '../operations/prompt';

function makeCtx(params: Record<string, unknown>, mockFn = vi.fn().mockResolvedValue({})) {
  return {
    helpers: { httpRequestWithAuthentication: mockFn.bind({}) },
    getCredentials: vi.fn().mockResolvedValue({ baseUrl: 'https://api.2kw.ai', apiKey: 'k' }),
    getNodeParameter: vi.fn((name: string) => {
      if (!(name in params)) throw new Error(`unexpected param ${name}`);
      return params[name];
    }),
    getNode: vi.fn().mockReturnValue({ name: '2kw' }),
  } as any;
}

describe('Prompt resource', () => {
  it('Get: reads promptId from resource locator (list mode)', async () => {
    const fn = vi.fn().mockResolvedValue({ id: 'p1', name: 'Greeting' });
    const ctx = makeCtx({ prompt: { mode: 'list', value: 'p1' } }, fn);
    const result = await executePrompt.call(ctx, 0, 'get');
    expect(fn.mock.calls[0][1].url).toBe('https://api.2kw.ai/v1/prompts/p1');
    expect(result).toEqual([{ json: { id: 'p1', name: 'Greeting' }, pairedItem: 0 }]);
  });

  it('Get: accepts plain string for back-compat', async () => {
    const fn = vi.fn().mockResolvedValue({});
    const ctx = makeCtx({ prompt: 'p1' }, fn);
    await executePrompt.call(ctx, 0, 'get');
    expect(fn.mock.calls[0][1].url).toBe('https://api.2kw.ai/v1/prompts/p1');
  });

  it('Compile: POSTs with resourceLocator-resolved promptId; reads versionId + label resourceLocator values', async () => {
    const fn = vi.fn().mockResolvedValue({ content: 'Hello Alice' });
    const ctx = makeCtx(
      {
        prompt: { mode: 'list', value: 'p1' },
        variables: { name: 'Alice' },
        versionId: '',
        label: { mode: 'list', value: 'prod' },
      },
      fn,
    );
    await executePrompt.call(ctx, 0, 'compile');
    expect(fn.mock.calls[0][1].url).toBe('https://api.2kw.ai/v1/prompts/p1/compile');
    expect(fn.mock.calls[0][1].body).toEqual({ variables: { name: 'Alice' }, label: 'prod' });
  });

  it('Compile: routes versionId when provided', async () => {
    const fn = vi.fn().mockResolvedValue({});
    const ctx = makeCtx(
      {
        prompt: { mode: 'list', value: 'p1' },
        variables: {},
        versionId: 'v9',
        label: { mode: 'list', value: '' },
      },
      fn,
    );
    await executePrompt.call(ctx, 0, 'compile');
    expect(fn.mock.calls[0][1].body).toEqual({ variables: {}, versionId: 'v9' });
  });

  it('Compile: omits both label and versionId when empty', async () => {
    const fn = vi.fn().mockResolvedValue({});
    const ctx = makeCtx(
      {
        prompt: { mode: 'list', value: 'p1' },
        variables: {},
        versionId: '',
        label: { mode: 'list', value: '' },
      },
      fn,
    );
    await executePrompt.call(ctx, 0, 'compile');
    expect(fn.mock.calls[0][1].body).toEqual({ variables: {} });
  });

  it('Resolve: GETs /v1/prompts/{id}/resolve with no query when label empty', async () => {
    const fn = vi.fn().mockResolvedValue({ content: 'X', metadata: {} });
    const ctx = makeCtx(
      { prompt: { mode: 'list', value: 'p1' }, resolveLabel: { mode: 'list', value: '' } },
      fn,
    );
    await executePrompt.call(ctx, 0, 'resolve');
    expect(fn.mock.calls[0][1].url).toBe('https://api.2kw.ai/v1/prompts/p1/resolve');
    expect(fn.mock.calls[0][1].qs).toBeUndefined();
  });

  it('Resolve: passes label as query string from resource locator', async () => {
    const fn = vi.fn().mockResolvedValue({});
    const ctx = makeCtx(
      { prompt: { mode: 'list', value: 'p1' }, resolveLabel: { mode: 'list', value: 'prod' } },
      fn,
    );
    await executePrompt.call(ctx, 0, 'resolve');
    expect(fn.mock.calls[0][1].qs).toEqual({ label: 'prod' });
  });

  it('throws on unknown operation', async () => {
    const ctx = makeCtx({});
    await expect(executePrompt.call(ctx, 0, 'unknown')).rejects.toThrow();
  });
});
