#!/usr/bin/env node
/**
 * Runs n8n's community-package scan against this working tree.
 *
 * `npx @n8n/scan-community-package n8n-nodes-2kw` — the command n8n's verified
 * programme requires to pass — only accepts a *published* package: it reads the
 * npm provenance attestation, fetches the attested GitHub commit, and lints that
 * checkout plus the tarball. So the obvious CI placement is post-publish, which
 * is too late to stop a regression from being released (#363).
 *
 * The scanner exports the lint leg on its own (`analyzePackage` +
 * `SOURCE_FILE_PATTERNS`), and the source it lints is exactly this directory —
 * the public mirror is a verbatim copy of n8n/. Pointing it at the working tree
 * reproduces the source half of the gate with no publish, no provenance and no
 * network. The tarball half still only exists after a publish; publish.yml runs
 * the real CLI there.
 *
 * The scanner pin in devDependencies is exact on purpose: a floating version
 * would change the gate under us, and a rule added upstream would surface as an
 * unexplained red pipeline on an unrelated MR.
 *
 * Linux only in practice — on Windows the scanner's CLI dies untarring a path
 * with a drive letter. This entry point never untars anything, so it runs
 * anywhere.
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
	analyzePackage,
	SOURCE_FILE_PATTERNS,
} from '@n8n/scan-community-package/scanner/scanner.mjs';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const result = await analyzePackage(packageDir, SOURCE_FILE_PATTERNS);

if (result.passed) {
	console.log('n8n community-package scan: no violations in the source tree.');
	process.exit(0);
}

console.error(result.details ?? result.message ?? 'Scan failed.');
console.error(
	'\nn8n community-package scan failed. These block submission to the verified-node programme.',
);
process.exit(1);
