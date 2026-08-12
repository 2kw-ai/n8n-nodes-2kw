import { describe, it, expect, vi } from 'vitest';
import { executeTranscription } from '../nodes/TwoKw/operations/transcription';

describe('Transcription resource', () => {
  it('Transcribe: uploads audio with model and optional fields', async () => {
    const fn = vi.fn().mockResolvedValue({ text: 'Hello world' });
    const ctx: any = {
      helpers: {
        httpRequestWithAuthentication: fn.bind({}),
        getBinaryDataBuffer: vi.fn().mockResolvedValue(Buffer.from('AUDIO', 'utf8')),
      },
      getCredentials: vi.fn().mockResolvedValue({ baseUrl: 'https://api.2kw.ai', apiKey: 'k' }),
      getNodeParameter: vi.fn((name: string) => {
        const map: Record<string, unknown> = {
          binaryPropertyName: 'data',
          model: 'openai/whisper-1',
          language: 'en',
          prompt: '',
          responseFormat: 'json',
          temperature: '',
        };
        if (!(name in map)) throw new Error(`unexpected ${name}`);
        return map[name];
      }),
      getInputData: vi.fn().mockReturnValue([
        { json: {}, binary: { data: { mimeType: 'audio/mpeg', fileName: 'note.mp3' } } },
      ]),
      getNode: vi.fn().mockReturnValue({ name: '2kw' }),
    };

    const result = await executeTranscription.call(ctx, 0, 'transcribe');

    const opts = fn.mock.calls[0][1];
    expect(opts.url).toBe('https://api.2kw.ai/v1/audio/transcriptions');
    expect(opts.method).toBe('POST');
    expect(opts.json).toBe(false);
    expect(opts.formData.model).toBe('openai/whisper-1');
    expect(opts.formData.language).toBe('en');
    expect(opts.formData.response_format).toBe('json');
    expect(opts.formData.prompt).toBeUndefined();
    expect(opts.formData.temperature).toBeUndefined();
    expect(opts.formData.file.options.filename).toBe('note.mp3');
    expect(result).toEqual([{ json: { text: 'Hello world' }, pairedItem: 0 }]);
  });

  it('throws on unknown operation', async () => {
    const ctx: any = { getNode: vi.fn().mockReturnValue({ name: '2kw' }) };
    await expect(executeTranscription.call(ctx, 0, 'unknown')).rejects.toThrow();
  });
});
