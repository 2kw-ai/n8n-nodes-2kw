/**
 * Whether n8n/ is checked out inside the backbone monorepo, or stands alone as the public
 * 2kw-ai/n8n-nodes-2kw mirror (#351) with nothing next to it (#1265, D7).
 *
 * The sync scripts used to key that on the sibling directory they copy from (cli/, mcp/). A
 * narrowed checkout that lacks the sibling then read as the mirror, and `--check` passed
 * without comparing anything. The marker is the root package.json of the monorepo instead: a
 * sparse-checkout cone always includes top-level files, so it survives a narrowed checkout,
 * and the mirror has no such file above n8n/. Inside the monorepo a missing sibling is then a
 * hard failure, as it is in mcp/'s own sync script.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** The `name` of the monorepo's root package.json. */
export const MONOREPO_PACKAGE_NAME = '@manfred-kunze-dev/backbone';

/**
 * True when the package.json one level above `packageRoot` is the monorepo's. Throws when that
 * file exists but does not parse: a broken root manifest (a conflict marker, a trailing comma)
 * must fail the guard, never make it pass as the mirror.
 */
export function isMonorepoCheckout(packageRoot: string): boolean {
  const manifest = resolve(packageRoot, '..', 'package.json');
  if (!existsSync(manifest)) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(manifest, 'utf8'));
  } catch (failed) {
    throw new Error(`Cannot tell a monorepo checkout from the mirror: ${manifest} does not parse (${String(failed)})`);
  }
  return typeof parsed === 'object' && parsed !== null && (parsed as { name?: unknown }).name === MONOREPO_PACKAGE_NAME;
}
