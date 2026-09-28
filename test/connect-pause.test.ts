import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  chatOriginFor,
  connectCallIds,
  pendingConnectionsOf,
  type PendingConnection,
} from '../nodes/TwoKw/operations/connect-pause';
import { connectorsUrlFor, pendingConnectionsJson } from '../nodes/TwoKw/operations/agent';

/** The golden fixture every client's decoder runs (#1086, spec §4); a synced copy of the CLI's. */
interface ConnectPauseCases {
  cases: { name: string; output: unknown; pending: PendingConnection[]; connectCallIds: string[] }[];
  chatOrigins: { baseUrl: unknown; origin: string }[];
}

const fixture: ConnectPauseCases = JSON.parse(
  readFileSync(resolve(__dirname, 'fixtures', 'connect-pause-cases.json'), 'utf-8'),
);

describe('the connect-pause decoder over the golden fixture (#1086)', () => {
  it.each(fixture.cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const pending = pendingConnectionsOf(c.output);
    expect(pending).toEqual(c.pending);
    expect([...connectCallIds(c.output, pending)].sort()).toEqual([...c.connectCallIds].sort());
  });

  // The workflow shape stays n8n's own (#807): `destinations` null when there are none, and the
  // Connectors page to open beside every connection.
  it.each(fixture.cases.map((c) => [c.name, c] as const))('the workflow item: %s', (_name, c) => {
    const connectUrl = 'https://chat.2kw.ai/connectors';
    expect(pendingConnectionsJson(c.output, connectUrl)).toEqual(
      c.pending.map((p) => ({
        serverLabel: p.serverLabel,
        host: p.host,
        reason: p.reason,
        destinations: p.destinations ?? null,
        connectUrl,
      })),
    );
  });
});

describe('chatOriginFor and connectorsUrlFor (#1086)', () => {
  it.each(fixture.chatOrigins.map((c) => [String(c.baseUrl), c] as const))('%s', (_name, c) => {
    expect(chatOriginFor(c.baseUrl)).toBe(c.origin);
    expect(connectorsUrlFor(c.baseUrl)).toBe(`${c.origin}/connectors`);
  });
});
