import { describe, it, expect, vi } from 'vitest';
import { executeSchema } from '../operations/schema';

describe('Schema resource', () => {
  it('Get: accepts plain string schema id (back-compat)', async () => {
    const httpRequestWithAuthentication = vi
      .fn()
      .mockResolvedValue({ id: 's1', name: 'Invoice' });
    const ctx: any = {
      helpers: { httpRequestWithAuthentication: httpRequestWithAuthentication.bind({}) },
      getCredentials: vi.fn().mockResolvedValue({ baseUrl: 'https://api.2kw.ai', apiKey: 'k' }),
      getNodeParameter: vi.fn((name: string) => {
        if (name === 'schema') return 's1';
        throw new Error(`unexpected param ${name}`);
      }),
      getNode: vi.fn().mockReturnValue({ name: '2kw' }),
    };
    const result = await executeSchema.call(ctx, 0, 'get');
    expect(result).toEqual([{ json: { id: 's1', name: 'Invoice' }, pairedItem: 0 }]);
    expect(httpRequestWithAuthentication.mock.calls[0][1].url).toBe(
      'https://api.2kw.ai/v1/schemas/s1',
    );
  });

  it('Get: accepts resource-locator object (list mode)', async () => {
    const httpRequestWithAuthentication = vi
      .fn()
      .mockResolvedValue({ id: 's1', name: 'Invoice' });
    const ctx: any = {
      helpers: { httpRequestWithAuthentication: httpRequestWithAuthentication.bind({}) },
      getCredentials: vi.fn().mockResolvedValue({ baseUrl: 'https://api.2kw.ai', apiKey: 'k' }),
      getNodeParameter: vi.fn((name: string) => {
        if (name === 'schema') return { mode: 'list', value: 's1' };
        throw new Error(`unexpected param ${name}`);
      }),
      getNode: vi.fn().mockReturnValue({ name: '2kw' }),
    };
    await executeSchema.call(ctx, 0, 'get');
    expect(httpRequestWithAuthentication.mock.calls[0][1].url).toBe(
      'https://api.2kw.ai/v1/schemas/s1',
    );
  });

  it('throws on unknown operation', async () => {
    const ctx: any = { getNode: vi.fn().mockReturnValue({ name: '2kw' }) };
    await expect(executeSchema.call(ctx, 0, 'unknown')).rejects.toThrow();
  });
});
