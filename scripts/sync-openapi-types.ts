#!/usr/bin/env tsx
/**
 * Copies mcp/src/generated/openapi.d.ts → n8n/generated/openapi.d.ts.
 * With --check flag, exits non-zero if files differ (CI guard).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// The sibling package whose generated types this one mirrors. Its presence is what
// distinguishes a monorepo checkout from the standalone public mirror (#351).
const MONOREPO_SIBLING = resolve(__dirname, '..', '..', 'mcp');
const SOURCE = resolve(MONOREPO_SIBLING, 'src', 'generated', 'openapi.d.ts');
const TARGET = resolve(__dirname, '..', 'generated', 'openapi.d.ts');

const checkOnly = process.argv.includes('--check');

function main(): void {
  // n8n/ is mirrored verbatim to the public 2kw-ai/n8n-nodes-2kw repo, where it is a
  // one-directory checkout with no mcp/ next to it and no way to re-derive the types.
  // `check-types` is a prerequisite of both `build` and `test`, so without this branch
  // the mirror's release workflow dies before it can publish.
  //
  // Keyed on the sibling directory, not on SOURCE, so the monorepo guard stays sharp:
  // an mcp/ that exists but has not been generated is still a hard failure below.
  if (!existsSync(MONOREPO_SIBLING)) {
    if (!checkOnly) {
      console.error('Cannot sync: this is a standalone checkout with no mcp/ package to copy from.');
      console.error('Run "npm run sync-types" in the backbone monorepo instead.');
      process.exit(1);
    }
    if (!existsSync(TARGET)) {
      console.error(`Target missing: ${TARGET}`);
      console.error('The published package must ship generated/openapi.d.ts.');
      process.exit(1);
    }
    console.log('Standalone checkout (no sibling mcp/) — using the committed generated/openapi.d.ts as-is.');
    return;
  }

  if (!existsSync(SOURCE)) {
    console.error(`Source not found: ${SOURCE}`);
    console.error('Run "npm run generate" in mcp/ first.');
    process.exit(1);
  }

  const sourceContent = readFileSync(SOURCE, 'utf8');

  if (checkOnly) {
    if (!existsSync(TARGET)) {
      console.error(`Target missing: ${TARGET}`);
      console.error('Run "npm run sync-types" to fix.');
      process.exit(1);
    }
    const targetContent = readFileSync(TARGET, 'utf8');
    if (sourceContent !== targetContent) {
      console.error('n8n/generated/openapi.d.ts is out of sync with mcp/src/generated/openapi.d.ts.');
      console.error('Run "npm run sync-types" to fix.');
      process.exit(1);
    }
    console.log('OpenAPI types in sync.');
    return;
  }

  writeFileSync(TARGET, sourceContent);
  console.log(`Synced ${SOURCE} → ${TARGET}`);
}

main();
