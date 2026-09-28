// GENERATED COPY of cli/src/lib/connect-pause.ts (#1086). Do not edit here: edit the CLI's file,
// then run `npm run sync-connect-pause` in n8n/. `npm run check-connect-pause` fails on any drift.
/**
 * The connect pause, decoded one way for every client (#1086, spec §4, D4): an open
 * `backbone:connector_auth_request` (#807 R12) is a connector the run waits for the user to
 * connect, allow or reconnect in chat.2kw.ai.
 *
 * This file is canonical. `mcp/src/lib/connect-pause.ts` and
 * `n8n/nodes/TwoKw/operations/connect-pause.ts` are byte copies of it under a header: edit it
 * here, then run `npm run sync:connect-pause` in mcp/ and `npm run sync-connect-pause` in n8n/.
 * Its golden fixture, `cli/tests/fixtures/connect-pause-cases.json`, is copied the same way into
 * mcp/, n8n/ and surface/, and every client's decoder test runs every case of it.
 *
 * Plain TypeScript with no imports, no `process`, no Node types and no timers, so n8n's source
 * scanner and its empty `dependencies` accept the copy. The CLI and the MCP server keep their
 * `AI_2KW_CHAT_URL` override in their own code, around {@link chatOriginFor}.
 */

/** Fallback chat.2kw.ai origin when the API host is not one we recognise. */
export const DEFAULT_CHAT_URL = "https://chat.2kw.ai";

/** Known API-host → chat web host mappings; a connect pause points the user there (#807 R11). */
export const CHAT_URL_BY_API_HOST: Readonly<Record<string, string>> = {
  "api.2kw.ai": "https://chat.2kw.ai",
  "api-dev.2kw.ai": "https://chat-dev.2kw.ai",
  "backbone.manfred-kunze.dev": "https://chat.2kw.ai",
  "localhost:8080": "http://localhost:3000",
  "127.0.0.1:8080": "http://localhost:3000",
};

/**
 * The chat web host that belongs to an API base URL, where a member connects a connector
 * (`<chat>/connectors`). An unknown host, an unparsable URL or no URL at all is chat.2kw.ai.
 */
export function chatOriginFor(baseUrl: unknown): string {
  try {
    const host = new URL(String(baseUrl ?? "")).host;
    // hasOwn, not a bare index: a host named after an Object.prototype key must not resolve.
    return Object.hasOwn(CHAT_URL_BY_API_HOST, host) ? CHAT_URL_BY_API_HOST[host] ?? DEFAULT_CHAT_URL : DEFAULT_CHAT_URL;
  } catch {
    return DEFAULT_CHAT_URL;
  }
}

/** What the user is asked to do: connect, allow the agent, or reconnect. */
export type ConnectReason = "connect" | "allow" | "reconnect";

export const CONNECT_REASONS: readonly ConnectReason[] = ["connect", "allow", "reconnect"];

/**
 * One open connect request. `id` (`cauth_<call id>`) and `callId` (the first connect call for
 * this connector) are what a client needs to withhold the connect calls; the CLI and the MCP
 * server drop both from what they publish.
 */
export interface PendingConnection {
  id: string;
  callId: string;
  serverLabel: string;
  /** The MCP server's host: what the user is asked to connect to. */
  host: string;
  reason: ConnectReason;
  /** The egress difference an allow is asked again for (#807 R9); absent otherwise, never empty. */
  destinations?: string[];
}

/** Enough of a connection to name it in a sentence. */
export interface ConnectTarget {
  serverLabel: string;
  host: string;
  reason: string;
}

const CONNECT_REQUEST = "backbone:connector_auth_request";

type Item = Record<string, unknown>;

function itemsOf(output: unknown): Item[] {
  if (!Array.isArray(output)) return [];
  return output.filter((item): item is Item => typeof item === "object" && item !== null && !Array.isArray(item));
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** The synthetic tool a connector's connect pause is raised through (#806). */
export function connectToolName(serverLabel: string): string {
  return `mcp__${serverLabel}__connect`;
}

/**
 * The connectors a response's `output` still waits on: every `in_progress` connect request whose
 * id no other-status projection in the same list resolved, one per id, in order. An item without
 * a non-empty `id`, `call_id`, `server_label` or `host` cannot be acted on and is skipped; a
 * `reason` outside the three reads as `connect`, the action that always applies; only the string
 * entries of `destinations` are kept, and none at all omits the field.
 */
export function pendingConnectionsOf(output: unknown): PendingConnection[] {
  const items = itemsOf(output);
  const resolved = new Set<string>();
  for (const item of items) {
    const id = text(item.id);
    if (item.type === CONNECT_REQUEST && id && item.status !== "in_progress") resolved.add(id);
  }
  const pending = new Map<string, PendingConnection>();
  for (const item of items) {
    if (item.type !== CONNECT_REQUEST || item.status !== "in_progress") continue;
    const id = text(item.id);
    const callId = text(item.call_id);
    const serverLabel = text(item.server_label);
    const host = text(item.host);
    if (!id || !callId || !serverLabel || !host || resolved.has(id) || pending.has(id)) continue;
    const reason = text(item.reason);
    const destinations = Array.isArray(item.destinations)
      ? item.destinations.filter((entry): entry is string => typeof entry === "string")
      : [];
    pending.set(id, {
      id,
      callId,
      serverLabel,
      host,
      reason: reason && (CONNECT_REASONS as readonly string[]).includes(reason) ? (reason as ConnectReason) : "connect",
      ...(destinations.length > 0 ? { destinations } : {}),
    });
  }
  return [...pending.values()];
}

/**
 * The call ids a connect pause withholds from the caller: the call each pending request names;
 * the own `call_id` of every open connect request, even one {@link pendingConnectionsOf} could not
 * describe (a missing `server_label` or `host`), since a connect call is the engine's to answer,
 * never the client's (R7); and every `mcp__<label>__connect` call for a connector in
 * `connections` (the model may call it more than once; one request stands for all of them).
 */
export function connectCallIds(
  output: unknown,
  connections: readonly Pick<PendingConnection, "callId" | "serverLabel">[]
): Set<string> {
  const names = new Set(connections.map((c) => connectToolName(c.serverLabel)));
  const ids = new Set(connections.map((c) => c.callId));
  const items = itemsOf(output);
  // Every open connect request's own call id is withheld, even one pendingConnectionsOf could
  // not fully describe (a missing server_label or host): the paired function_call must never be
  // left for the caller to fabricate an output for (R7).
  const resolved = new Set<string>();
  for (const item of items) {
    const id = text(item.id);
    if (item.type === CONNECT_REQUEST && id && item.status !== "in_progress") resolved.add(id);
  }
  for (const item of items) {
    if (item.type !== CONNECT_REQUEST || item.status !== "in_progress") continue;
    const id = text(item.id);
    if (id && resolved.has(id)) continue;
    const callId = text(item.call_id);
    if (callId) ids.add(callId);
  }
  for (const item of items) {
    const callId = text(item.call_id);
    if (item.type === "function_call" && callId && typeof item.name === "string" && names.has(item.name)) ids.add(callId);
  }
  return ids;
}

/** "connect erp (erp.example.com)", "allow the agent to use …" or "reconnect …". */
export function connectionPhrase(c: ConnectTarget): string {
  const target = `${c.serverLabel} (${c.host})`;
  if (c.reason === "allow") return `allow the agent to use ${target}`;
  if (c.reason === "reconnect") return `reconnect ${target}`;
  return `connect ${target}`;
}

/** "connect a (h), allow the agent to use b (h) and reconnect c (h)"; empty for none. */
export function connectionsPhrase(connections: readonly ConnectTarget[]): string {
  const phrases = connections.map(connectionPhrase);
  if (phrases.length < 2) return phrases[0] ?? "";
  return `${phrases.slice(0, -1).join(", ")} and ${phrases[phrases.length - 1]}`;
}
