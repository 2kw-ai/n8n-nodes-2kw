import { describe, it, expect, vi } from 'vitest';
import { executeDocument } from '../nodes/TwoKw/operations/document';

describe('Document resource', () => {
  it('Convert: uploads binary file as multipart and splits response into per-document items', async () => {
    const fn = vi.fn().mockResolvedValue({
      status: 'SUCCESS',
      processingTime: 0.5,
      timings: {},
      documents: [{ filename: 'invoice.pdf', mdContent: '# Hello' }],
      errors: [],
    });
    const ctx: any = {
      helpers: {
        httpRequestWithAuthentication: fn.bind({}),
        getBinaryDataBuffer: vi.fn().mockResolvedValue(Buffer.from('PDFDATA', 'utf8')),
      },
      getCredentials: vi.fn().mockResolvedValue({ baseUrl: 'https://api.2kw.ai', apiKey: 'k' }),
      getNodeParameter: vi.fn((name: string) => {
        const map: Record<string, unknown> = {
          binaryPropertyName: 'data',
          outputFormats: ['MD'],
        };
        if (!(name in map)) throw new Error(`unexpected ${name}`);
        return map[name];
      }),
      getInputData: vi.fn().mockReturnValue([
        { json: {}, binary: { data: { mimeType: 'application/pdf', fileName: 'invoice.pdf' } } },
      ]),
      getNode: vi.fn().mockReturnValue({ name: '2kw' }),
    };

    const result = await executeDocument.call(ctx, 0, 'convert');

    const opts = fn.mock.calls[0][1];
    expect(opts.url).toBe('https://api.2kw.ai/v1/convert/file');
    expect(opts.method).toBe('POST');
    expect(opts.json).toBe(false);
    expect(opts.formData.files.options.filename).toBe('invoice.pdf');
    expect(opts.formData.files.options.contentType).toBe('application/pdf');

    expect(result).toEqual([
      {
        json: {
          filename: 'invoice.pdf',
          mdContent: '# Hello',
          _response: { status: 'SUCCESS', processingTime: 0.5, timings: {} },
        },
        pairedItem: 0,
      },
    ]);
  });

  it('Convert: throws when binary property is missing', async () => {
    const ctx: any = {
      helpers: { httpRequestWithAuthentication: vi.fn(), getBinaryDataBuffer: vi.fn() },
      getCredentials: vi.fn().mockResolvedValue({ baseUrl: 'https://api.2kw.ai', apiKey: 'k' }),
      getNodeParameter: vi.fn((name: string) => {
        if (name === 'binaryPropertyName') return 'data';
        if (name === 'outputFormats') return ['MD'];
        throw new Error(`unexpected ${name}`);
      }),
      getInputData: vi.fn().mockReturnValue([{ json: {} }]),
      getNode: vi.fn().mockReturnValue({ name: '2kw' }),
    };
    await expect(executeDocument.call(ctx, 0, 'convert')).rejects.toThrow(/binary property/i);
  });

  it('ConvertSource (URL): POSTs http source and outputFormats; splits response', async () => {
    const fn = vi.fn().mockResolvedValue({
      status: 'SUCCESS',
      processingTime: 0.32,
      timings: {},
      documents: [
        { filename: 'a.pdf', mdContent: '# A', textContent: 'A' },
        { filename: 'b.pdf', mdContent: '# B', textContent: 'B' },
      ],
      errors: [],
    });
    const ctx: any = {
      helpers: { httpRequestWithAuthentication: fn.bind({}) },
      getCredentials: vi.fn().mockResolvedValue({ baseUrl: 'https://api.2kw.ai', apiKey: 'k' }),
      getNodeParameter: vi.fn((name: string) => {
        const map: Record<string, unknown> = {
          sourceType: 'url',
          sourceUrl: 'https://example.com/doc.pdf',
          sourceHeaders: '{}',
          pipeline: 'fast',
          outputFormats: ['MD', 'TEXT'],
        };
        if (!(name in map)) throw new Error(`unexpected ${name}`);
        return map[name];
      }),
      getNode: vi.fn().mockReturnValue({ name: '2kw' }),
    };

    const result = await executeDocument.call(ctx, 0, 'convertSource');

    expect(fn.mock.calls[0][1].url).toBe('https://api.2kw.ai/v1/convert/source');
    expect(fn.mock.calls[0][1].body).toEqual({
      sources: [{ kind: 'http', url: 'https://example.com/doc.pdf' }],
      options: { pipeline: 'fast', options: { outputFormats: ['MD', 'TEXT'] } },
    });
    expect(result).toHaveLength(2);
    expect(result[0].json.filename).toBe('a.pdf');
    expect(result[1].json.filename).toBe('b.pdf');
    expect(result[0].json._response).toEqual({
      status: 'SUCCESS',
      processingTime: 0.32,
      timings: {},
    });
  });

  it('ConvertSource: error rows surface as items with _response.error: true', async () => {
    const fn = vi.fn().mockResolvedValue({
      status: 'PARTIAL_SUCCESS',
      processingTime: 0.1,
      timings: {},
      documents: [{ filename: 'ok.pdf', mdContent: '# OK' }],
      errors: [{ filename: 'bad.attachment', message: 'unsupported' }],
    });
    const ctx: any = {
      helpers: { httpRequestWithAuthentication: fn.bind({}) },
      getCredentials: vi.fn().mockResolvedValue({ baseUrl: 'https://api.2kw.ai', apiKey: 'k' }),
      getNodeParameter: vi.fn((name: string) => {
        const map: Record<string, unknown> = {
          sourceType: 'url',
          sourceUrl: 'https://example.com/x.eml',
          sourceHeaders: '{}',
          pipeline: 'fast',
          outputFormats: ['MD'],
        };
        return map[name];
      }),
      getNode: vi.fn().mockReturnValue({ name: '2kw' }),
    };

    const result = await executeDocument.call(ctx, 0, 'convertSource');
    expect(result).toHaveLength(2);
    expect(result[1].json.message).toBe('unsupported');
    expect(result[1].json._response).toMatchObject({ error: true });
  });

  it('ConvertSource (Base64): includes base64 source + outputFormats', async () => {
    const fn = vi.fn().mockResolvedValue({
      status: 'SUCCESS',
      documents: [{ filename: 'sample.pdf', mdContent: '# S' }],
    });
    const ctx: any = {
      helpers: { httpRequestWithAuthentication: fn.bind({}) },
      getCredentials: vi.fn().mockResolvedValue({ baseUrl: 'https://api.2kw.ai', apiKey: 'k' }),
      getNodeParameter: vi.fn((name: string) => {
        const map: Record<string, unknown> = {
          sourceType: 'base64',
          sourceData: 'JVBERi0xLjQK',
          sourceMimeType: 'application/pdf',
          sourceFilename: 'sample.pdf',
          pipeline: 'ocr',
          outputFormats: ['MD'],
        };
        return map[name];
      }),
      getNode: vi.fn().mockReturnValue({ name: '2kw' }),
    };

    await executeDocument.call(ctx, 0, 'convertSource');

    expect(fn.mock.calls[0][1].body).toEqual({
      sources: [
        {
          kind: 'base64',
          content: 'JVBERi0xLjQK',
          mimeType: 'application/pdf',
          filename: 'sample.pdf',
        },
      ],
      options: { pipeline: 'ocr', options: { outputFormats: ['MD'] } },
    });
  });

  it('throws on unknown operation', async () => {
    const ctx: any = { getNode: vi.fn().mockReturnValue({ name: '2kw' }) };
    await expect(executeDocument.call(ctx, 0, 'unknown')).rejects.toThrow();
  });
});
