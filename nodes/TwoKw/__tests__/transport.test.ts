import { describe, it, expect, vi } from 'vitest';
import { apiRequest, extractResourceId } from '../transport';

describe('apiRequest', () => {
  it('builds URL with path params and dispatches via httpRequestWithAuthentication', async () => {
    const httpRequestWithAuthentication = vi.fn().mockResolvedValue({ id: 's1', name: 'Test schema' });
    const ctx: any = {
      helpers: { httpRequestWithAuthentication: httpRequestWithAuthentication.bind({}) },
      getCredentials: vi.fn().mockResolvedValue({ baseUrl: 'https://api.2kw.ai', apiKey: 'k' }),
    };

    const result = await apiRequest(ctx, 'GET', '/v1/schemas/{id}', {
      pathParams: { id: 's1' },
    });

    expect(result).toEqual({ id: 's1', name: 'Test schema' });
    expect(httpRequestWithAuthentication).toHaveBeenCalledTimes(1);
    const [credName, options] = httpRequestWithAuthentication.mock.calls[0];
    expect(credName).toBe('2kwApi');
    expect(options.method).toBe('GET');
    expect(options.url).toBe('https://api.2kw.ai/v1/schemas/s1');
  });

  it('serializes JSON body and sets json:true', async () => {
    const httpRequestWithAuthentication = vi.fn().mockResolvedValue({ ok: true });
    const ctx: any = {
      helpers: { httpRequestWithAuthentication: httpRequestWithAuthentication.bind({}) },
      getCredentials: vi.fn().mockResolvedValue({ baseUrl: 'https://api.2kw.ai', apiKey: 'k' }),
    };

    await apiRequest(ctx, 'POST', '/v1/extractions', { body: { schemaId: 's1', model: 'openai/gpt-4o' } });

    const options = httpRequestWithAuthentication.mock.calls[0][1];
    expect(options.body).toEqual({ schemaId: 's1', model: 'openai/gpt-4o' });
    expect(options.json).toBe(true);
  });

  it('strips trailing slashes on baseUrl', async () => {
    const httpRequestWithAuthentication = vi.fn().mockResolvedValue({});
    const ctx: any = {
      helpers: { httpRequestWithAuthentication: httpRequestWithAuthentication.bind({}) },
      getCredentials: vi.fn().mockResolvedValue({ baseUrl: 'https://api.2kw.ai/', apiKey: 'k' }),
    };

    await apiRequest(ctx, 'GET', '/v1/schemas/{id}', { pathParams: { id: 's1' } });

    expect(httpRequestWithAuthentication.mock.calls[0][1].url).toBe('https://api.2kw.ai/v1/schemas/s1');
  });

  it('appends query string', async () => {
    const httpRequestWithAuthentication = vi.fn().mockResolvedValue({});
    const ctx: any = {
      helpers: { httpRequestWithAuthentication: httpRequestWithAuthentication.bind({}) },
      getCredentials: vi.fn().mockResolvedValue({ baseUrl: 'https://api.2kw.ai', apiKey: 'k' }),
    };

    await apiRequest(ctx, 'GET', '/v1/prompts/{promptId}/resolve', {
      pathParams: { promptId: 'p1' },
      query: { label: 'prod' },
    });

    expect(httpRequestWithAuthentication.mock.calls[0][1].qs).toEqual({ label: 'prod' });
  });

  it('rethrows API errors as NodeApiError-shaped errors', async () => {
    const httpRequestWithAuthentication = vi.fn().mockRejectedValue({
      response: { status: 422, body: { message: 'Schema not found' } },
    });
    const ctx: any = {
      helpers: { httpRequestWithAuthentication: httpRequestWithAuthentication.bind({}) },
      getCredentials: vi.fn().mockResolvedValue({ baseUrl: 'https://api.2kw.ai', apiKey: 'k' }),
      getNode: vi.fn().mockReturnValue({ name: '2kw' }),
    };

    await expect(
      apiRequest(ctx, 'GET', '/v1/schemas/{id}', { pathParams: { id: 'missing' } }),
    ).rejects.toThrow();
  });
});

describe('extractResourceId', () => {
  it('returns plain string unchanged', () => {
    expect(extractResourceId('abc-123')).toBe('abc-123');
  });

  it('extracts value from resource-locator object (list mode)', () => {
    expect(extractResourceId({ mode: 'list', value: 'sch-1' })).toBe('sch-1');
  });

  it('extracts value from resource-locator object (id mode)', () => {
    expect(extractResourceId({ mode: 'id', value: 'sch-2' })).toBe('sch-2');
  });

  it('returns empty string for null/undefined/missing value', () => {
    expect(extractResourceId(null)).toBe('');
    expect(extractResourceId(undefined)).toBe('');
    expect(extractResourceId({ mode: 'list' })).toBe('');
  });
});
