import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { answerUrlFor, pendingInputsOf, type PendingInput } from '../nodes/TwoKw/operations/connect-pause';

/** The golden fixture every client decodes an input pause against (#1320, spec §12); a synced copy of the CLI's. */
interface InputPauseCases {
  chatOrigin: string;
  forbidden: string[];
  cases: { name: string; conversationId: string | null; output: unknown; pending: PendingInput[]; answerUrl: string }[];
}

const fixture: InputPauseCases = JSON.parse(
  readFileSync(resolve(__dirname, 'fixtures', 'input-pause-cases.json'), 'utf-8'),
);

describe('the input-pause decoder over the golden fixture (#1320)', () => {
  it.each(fixture.cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const pending = pendingInputsOf(c.output);
    expect(pending).toEqual(c.pending);
    expect(answerUrlFor(fixture.chatOrigin, c.conversationId)).toBe(c.answerUrl);
    // Never the server's message, schema or URL (D7).
    const published = JSON.stringify(pending);
    for (const marker of fixture.forbidden) expect(published).not.toContain(marker);
  });
});
