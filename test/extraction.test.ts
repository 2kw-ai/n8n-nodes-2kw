import { describe, it, expect, vi } from 'vitest';
import { executeExtraction } from '../nodes/TwoKw/operations/extraction';

function makeCtx(params: Record<string, unknown>, mockFn = vi.fn().mockResolvedValue({})) {
  return {
    helpers: {
      httpRequestWithAuthentication: mockFn.bind({}),
      getBinaryDataBuffer: vi.fn().mockResolvedValue(Buffer.from('IMG', 'utf8')),
    },
    getCredentials: vi.fn().mockResolvedValue({ baseUrl: 'https://api.2kw.ai', apiKey: 'k' }),
    getNodeParameter: vi.fn((name: string) => {
      if (!(name in params)) throw new Error(`unexpected param ${name}`);
      return params[name];
    }),
    getInputData: vi.fn().mockReturnValue([
      { json: {}, binary: { image1: { mimeType: 'image/png' } } },
    ]),
    getNode: vi.fn().mockReturnValue({ name: '2kw' }),
  } as any;
}

describe('Extraction resource', () => {
  it('Run: text-only POSTs to /v1/extractions', async () => {
    const fn = vi.fn().mockResolvedValue({ id: 'e1', result: { foo: 'bar' } });
    const ctx = makeCtx(
      {
        schema: 's1',
        schemaVersion: '',
        model: 'openai/gpt-4o',
        inputText: 'invoice text',
        useBinaryImages: false,
        binaryProperties: '',
        waitForCompletion: false,
        pollIntervalSec: 2,
        pollTimeoutSec: 600,
      },
      fn,
    );

    const result = await executeExtraction.call(ctx, 0, 'run');

    expect(fn.mock.calls[0][1].url).toBe('https://api.2kw.ai/v1/extractions');
    expect(fn.mock.calls[0][1].body).toEqual({
      schemaId: 's1',
      model: 'openai/gpt-4o',
      inputText: 'invoice text',
    });
    expect(result).toEqual([{ json: { id: 'e1', result: { foo: 'bar' } }, pairedItem: 0 }]);
  });

  it('Run: includes schemaVersionId when provided', async () => {
    const fn = vi.fn().mockResolvedValue({});
    const ctx = makeCtx(
      {
        schema: 's1',
        schemaVersion: 'v9',
        model: 'openai/gpt-4o',
        inputText: 'x',
        useBinaryImages: false,
        binaryProperties: '',
        waitForCompletion: false,
        pollIntervalSec: 2,
        pollTimeoutSec: 600,
      },
      fn,
    );
    await executeExtraction.call(ctx, 0, 'run');
    expect(fn.mock.calls[0][1].body.schemaVersionId).toBe('v9');
  });

  it('Run: with binary images, base64-encodes from input item', async () => {
    const fn = vi.fn().mockResolvedValue({});
    const ctx = makeCtx(
      {
        schema: 's1',
        schemaVersion: '',
        model: 'openai/gpt-4o',
        inputText: '',
        useBinaryImages: true,
        binaryProperties: 'image1',
        waitForCompletion: false,
        pollIntervalSec: 2,
        pollTimeoutSec: 600,
      },
      fn,
    );
    await executeExtraction.call(ctx, 0, 'run');
    const body = fn.mock.calls[0][1].body;
    expect(body.inputImages).toEqual([
      { data: Buffer.from('IMG', 'utf8').toString('base64'), mimeType: 'image/png' },
    ]);
    expect(body.inputText).toBeUndefined();
  });

  it('Run: rejects when neither inputText nor binary images supplied', async () => {
    const ctx = makeCtx({
      schema: 's1',
      schemaVersion: '',
      model: 'openai/gpt-4o',
      inputText: '',
      useBinaryImages: false,
      binaryProperties: '',
      waitForCompletion: false,
      pollIntervalSec: 2,
      pollTimeoutSec: 600,
    });
    await expect(executeExtraction.call(ctx, 0, 'run')).rejects.toThrow(/inputText or images/);
  });

  it('throws on unknown operation', async () => {
    const ctx = makeCtx({});
    await expect(executeExtraction.call(ctx, 0, 'unknown')).rejects.toThrow();
  });

  it('Get: calls GET /v1/extractions/{id}', async () => {
    const fn = vi.fn().mockResolvedValue({ id: 'e1', status: 'COMPLETED', result: { ok: true } });
    const ctx = makeCtx({ extractionId: 'e1' }, fn);
    const result = await executeExtraction.call(ctx, 0, 'get');
    expect(fn.mock.calls[0][1].url).toBe('https://api.2kw.ai/v1/extractions/e1');
    expect(fn.mock.calls[0][1].method).toBe('GET');
    expect(result).toEqual([
      { json: { id: 'e1', status: 'COMPLETED', result: { ok: true } }, pairedItem: 0 },
    ]);
  });

  it('Estimate: POSTs to /v1/extractions/estimate with required fields', async () => {
    const fn = vi.fn().mockResolvedValue({
      inputTokens: 1500,
      estimatedOutputTokens: 200,
      strategy: 'SINGLE_SHOT',
    });
    const ctx = makeCtx(
      { schema: 's1', schemaVersion: '', estimateInputText: 'hello world' },
      fn,
    );

    const result = await executeExtraction.call(ctx, 0, 'estimate');

    expect(fn.mock.calls[0][1].url).toBe('https://api.2kw.ai/v1/extractions/estimate');
    expect(fn.mock.calls[0][1].method).toBe('POST');
    expect(fn.mock.calls[0][1].body).toEqual({ schemaId: 's1', inputText: 'hello world' });
    expect(result).toEqual([
      {
        json: { inputTokens: 1500, estimatedOutputTokens: 200, strategy: 'SINGLE_SHOT' },
        pairedItem: 0,
      },
    ]);
  });

  it('Estimate: includes schemaVersionId when provided', async () => {
    const fn = vi.fn().mockResolvedValue({});
    const ctx = makeCtx(
      { schema: 's1', schemaVersion: 'v9', estimateInputText: 'x' },
      fn,
    );
    await executeExtraction.call(ctx, 0, 'estimate');
    expect(fn.mock.calls[0][1].body.schemaVersionId).toBe('v9');
  });

  it('Run (sync, waitForCompletion=false): POSTs to /v1/extractions and returns the response', async () => {
    // Existing v1 sync behaviour — explicit toggle off.
    const fn = vi.fn().mockResolvedValue({ id: 'e1', status: 'COMPLETED', result: { ok: true } });
    const ctx = makeCtx(
      {
        schema: 's1',
        schemaVersion: '',
        model: 'openai/gpt-4o',
        inputText: 'invoice text',
        useBinaryImages: false,
        binaryProperties: '',
        waitForCompletion: false,
        pollIntervalSec: 2,
        pollTimeoutSec: 600,
      },
      fn,
    );

    const result = await executeExtraction.call(ctx, 0, 'run');

    expect(fn.mock.calls[0][1].url).toBe('https://api.2kw.ai/v1/extractions');
    expect(result).toEqual([
      { json: { id: 'e1', status: 'COMPLETED', result: { ok: true } }, pairedItem: 0 },
    ]);
  });

  it('Run (async + wait): POSTs to /v1/extractions/async then polls until COMPLETED', async () => {
    const submitResponse = { id: 'e9', status: 'PROCESSING' };
    const pollResponses = [
      { id: 'e9', status: 'PROCESSING' },
      { id: 'e9', status: 'COMPLETED', result: { foo: 'bar' } },
    ];
    let pollCalls = 0;
    const fn = vi.fn().mockImplementation(async (_credName: string, opts: any) => {
      if (opts.url === 'https://api.2kw.ai/v1/extractions/async') return submitResponse;
      if (opts.url === 'https://api.2kw.ai/v1/extractions/e9') return pollResponses[pollCalls++];
      throw new Error(`unexpected url ${opts.url}`);
    });
    const ctx = makeCtx(
      {
        schema: 's1',
        schemaVersion: '',
        model: 'openai/gpt-4o',
        inputText: 'big doc',
        useBinaryImages: false,
        binaryProperties: '',
        waitForCompletion: true,
        pollIntervalSec: 0.001,
        pollTimeoutSec: 10,
      },
      fn,
    );

    const result = await executeExtraction.call(ctx, 0, 'run');

    // First call: async submit
    expect(fn.mock.calls[0][1].url).toBe('https://api.2kw.ai/v1/extractions/async');
    expect(fn.mock.calls[0][1].method).toBe('POST');
    // Then at least one poll
    expect(fn.mock.calls[1][1].url).toBe('https://api.2kw.ai/v1/extractions/e9');
    expect(fn.mock.calls[1][1].method).toBe('GET');
    expect(result).toEqual([
      { json: { id: 'e9', status: 'COMPLETED', result: { foo: 'bar' } }, pairedItem: 0 },
    ]);
  });

  it('Run (async + wait): throws NodeOperationError when status terminates as FAILED', async () => {
    const submitResponse = { id: 'eF', status: 'PROCESSING' };
    const fn = vi.fn().mockImplementation(async (_credName: string, opts: any) => {
      if (opts.url.endsWith('/async')) return submitResponse;
      return { id: 'eF', status: 'FAILED', error: 'schema validation failed' };
    });
    const ctx = makeCtx(
      {
        schema: 's1',
        schemaVersion: '',
        model: 'openai/gpt-4o',
        inputText: 'x',
        useBinaryImages: false,
        binaryProperties: '',
        waitForCompletion: true,
        pollIntervalSec: 0.001,
        pollTimeoutSec: 10,
      },
      fn,
    );

    await expect(executeExtraction.call(ctx, 0, 'run')).rejects.toThrow(
      /extraction failed/i,
    );
  });

  it('Run: accepts schema + schemaVersion as resource locator objects', async () => {
    const fn = vi.fn().mockResolvedValue({ id: 'e1', status: 'COMPLETED' });
    const ctx = makeCtx(
      {
        schema: { mode: 'list', value: 's1' },
        schemaVersion: { mode: 'list', value: 'v9' },
        model: 'openai/gpt-4o',
        inputText: 'x',
        useBinaryImages: false,
        binaryProperties: '',
        waitForCompletion: false,
        pollIntervalSec: 2,
        pollTimeoutSec: 600,
      },
      fn,
    );
    await executeExtraction.call(ctx, 0, 'run');
    expect(fn.mock.calls[0][1].body).toEqual({
      schemaId: 's1',
      model: 'openai/gpt-4o',
      schemaVersionId: 'v9',
      inputText: 'x',
    });
  });
});
