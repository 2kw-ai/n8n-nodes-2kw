import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isMonorepoCheckout } from '../scripts/monorepo';

/**
 * The sync scripts' standalone branch is keyed on a monorepo marker, not on the sibling
 * directory they copy from (#1265, D7): a narrowed checkout that lacks cli/ or mcp/ must fail,
 * not silently pass as the public mirror.
 */
describe('isMonorepoCheckout (#1265)', () => {
  const roots: string[] = [];

  function layout(rootManifest?: unknown): string {
    const root = mkdtempSync(join(tmpdir(), 'n8n-monorepo-'));
    roots.push(root);
    const packageRoot = join(root, 'n8n');
    mkdirSync(packageRoot);
    if (rootManifest !== undefined) {
      writeFileSync(join(root, 'package.json'), JSON.stringify(rootManifest));
    }
    return packageRoot;
  }

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it('is true under the backbone root package.json, even with no cli/ or mcp/ next to it', () => {
    expect(isMonorepoCheckout(layout({ name: '@manfred-kunze-dev/backbone', private: true }))).toBe(true);
  });

  it('is false with no root package.json, as in the public mirror', () => {
    expect(isMonorepoCheckout(layout())).toBe(false);
  });

  it('is false under a root package.json of another name', () => {
    expect(isMonorepoCheckout(layout({ name: 'n8n-nodes-2kw' }))).toBe(false);
  });

  it('throws on a root package.json that does not parse, instead of reading as the mirror', () => {
    const packageRoot = layout();
    writeFileSync(join(packageRoot, '..', 'package.json'), '{ "name": "@manfred-kunze-dev/backbone", }');
    expect(() => isMonorepoCheckout(packageRoot)).toThrow(/package\.json/);
  });
});
