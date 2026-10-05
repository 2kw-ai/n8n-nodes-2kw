#!/usr/bin/env tsx
/**
 * Copies the CLI's connect-pause module and its golden fixture into this package (#1086, spec §4):
 *
 *   cli/src/lib/connect-pause.ts               → n8n/nodes/TwoKw/operations/connect-pause.ts (under a header)
 *   cli/tests/fixtures/connect-pause-cases.json → n8n/test/fixtures/connect-pause-cases.json
 *   cli/tests/fixtures/input-pause-cases.json   → n8n/test/fixtures/input-pause-cases.json (#1320)
 *
 * With --check it writes nothing and exits non-zero when either copy differs from its source
 * (the CI guard, run by `npm test`). Line endings are normalized before comparing, as
 * cli/openapi/scripts/check-generated.ts does; .gitattributes pins the copies to LF.
 *
 * The sync-openapi-types.ts arrangement (#351): n8n/ is mirrored verbatim to the public
 * 2kw-ai/n8n-nodes-2kw repo, a one-directory checkout with no cli/ next to it. There --check
 * accepts the committed copies, so the mirror's release still runs `npm test`; the guard is
 * sharp in the monorepo only. Which of the two this is comes from the monorepo marker
 * (scripts/monorepo.ts, #1265), not from cli/ being there: inside the monorepo a missing cli/
 * is a hard failure.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMonorepoCheckout } from './monorepo';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// The sibling package whose module this one copies.
const MONOREPO_SIBLING = resolve(packageRoot, '..', 'cli');

/** The header the module's copy starts with; the module itself follows it byte for byte. */
const HEADER =
  '// GENERATED COPY of cli/src/lib/connect-pause.ts (#1086). Do not edit here: edit the CLI\'s file,\n' +
  '// then run `npm run sync-connect-pause` in n8n/. `npm run check-connect-pause` fails on any drift.\n';

const copies = [
  {
    source: resolve(MONOREPO_SIBLING, 'src', 'lib', 'connect-pause.ts'),
    target: resolve(packageRoot, 'nodes', 'TwoKw', 'operations', 'connect-pause.ts'),
    header: HEADER,
  },
  {
    source: resolve(MONOREPO_SIBLING, 'tests', 'fixtures', 'connect-pause-cases.json'),
    target: resolve(packageRoot, 'test', 'fixtures', 'connect-pause-cases.json'),
    header: '',
  },
  // The input pause's golden fixture (#1320), decoded by the same module.
  {
    source: resolve(MONOREPO_SIBLING, 'tests', 'fixtures', 'input-pause-cases.json'),
    target: resolve(packageRoot, 'test', 'fixtures', 'input-pause-cases.json'),
    header: '',
  },
];

const checkOnly = process.argv.includes('--check');

function normalizeEol(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

function main(): void {
  if (!isMonorepoCheckout(packageRoot)) {
    if (!checkOnly) {
      console.error('Cannot sync: this is a standalone checkout with no cli/ package to copy from.');
      console.error('Run "npm run sync-connect-pause" in the backbone monorepo instead.');
      process.exit(1);
    }
    const missing = copies.filter(({ target }) => !existsSync(target));
    if (missing.length > 0) {
      for (const { target } of missing) console.error(`Target missing: ${target}`);
      process.exit(1);
    }
    console.log('Standalone checkout (no backbone monorepo) — using the committed connect-pause copies as-is.');
    return;
  }
  if (!existsSync(MONOREPO_SIBLING)) {
    console.error(`This is the backbone monorepo, but ${MONOREPO_SIBLING} is missing.`);
    console.error('A narrowed checkout must include cli/ for the connect-pause guard to compare anything.');
    process.exit(1);
  }

  let failed = false;
  for (const { source, target, header } of copies) {
    if (!existsSync(source)) {
      console.error(`Source not found: ${source}`);
      failed = true;
      continue;
    }
    const expected = header + normalizeEol(readFileSync(source, 'utf8'));
    if (checkOnly) {
      if (!existsSync(target) || normalizeEol(readFileSync(target, 'utf8')) !== expected) {
        console.error(`${target} is out of sync with ${source}.`);
        console.error('Run "npm run sync-connect-pause" to fix.');
        failed = true;
      }
      continue;
    }
    writeFileSync(target, expected);
    console.log(`Synced ${source} → ${target}`);
  }
  if (failed) process.exit(1);
  if (checkOnly) console.log('Connect-pause copies in sync.');
}

main();
