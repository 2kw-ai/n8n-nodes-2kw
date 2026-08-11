import { describe, it, expect } from 'vitest';
import { splitConvertResponse } from '../splitConvert';

describe('splitConvertResponse', () => {
  it('returns one item per document with _response metadata attached', () => {
    const response = {
      status: 'SUCCESS',
      processingTime: 1.23,
      timings: { foo: 0.5 },
      documents: [
        { filename: 'a.pdf', mdContent: '# A' },
        { filename: 'b.pdf', mdContent: '# B' },
      ],
      errors: [],
    };
    const items = splitConvertResponse(response, 0);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      json: {
        filename: 'a.pdf',
        mdContent: '# A',
        _response: { status: 'SUCCESS', processingTime: 1.23, timings: { foo: 0.5 } },
      },
      pairedItem: 0,
    });
    expect(items[1].json.filename).toBe('b.pdf');
  });

  it('emits error items flagged via _response.error: true', () => {
    const response = {
      status: 'PARTIAL_SUCCESS',
      processingTime: 0.5,
      timings: {},
      documents: [{ filename: 'ok.pdf', mdContent: '# OK' }],
      errors: [{ filename: 'bad.eml.attachment', message: 'unsupported format' }],
    };
    const items = splitConvertResponse(response, 0);
    expect(items).toHaveLength(2);
    expect(items[1]).toEqual({
      json: {
        filename: 'bad.eml.attachment',
        message: 'unsupported format',
        _response: {
          status: 'PARTIAL_SUCCESS',
          processingTime: 0.5,
          timings: {},
          error: true,
        },
      },
      pairedItem: 0,
    });
  });

  it('handles missing documents and errors arrays', () => {
    const items = splitConvertResponse({ status: 'SUCCESS' }, 0);
    expect(items).toEqual([]);
  });

  it('preserves pairedItem index per call', () => {
    const items = splitConvertResponse(
      { documents: [{ filename: 'x' }], errors: [] },
      7,
    );
    expect(items[0].pairedItem).toBe(7);
  });
});
