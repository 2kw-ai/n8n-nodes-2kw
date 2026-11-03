# Contributing to n8n-nodes-2kw

This file is for people who change the node. It is not part of the npm package; users read [README.md](README.md).

## Where the source lives

The source of truth is the `n8n/` directory of the 2kw.ai monorepo. `github.com/2kw-ai/n8n-nodes-2kw` is a **one-way mirror written only by release CI**: pull requests and direct commits there are overwritten by the next release. Report issues on GitHub; patches go against the monorepo.

## Releases and versions

The published version is the 2kw.ai platform version, stamped by release CI, the same scheme `@2kw/ai` (CLI) and `@2kw/ai-mcp-server` use. The `version` field committed in `package.json` is a placeholder and never ships. There were no `1.x`–`4.x` releases of this node: the first npm release jumped from the internal `0.3.0` to the platform's major at the time.

Prereleases publish under the `dev` dist-tag (`npm install n8n-nodes-2kw@dev`), stable releases under `latest`. Publishing happens from `.github/workflows/publish.yml` in the mirror, with npm provenance, which n8n's verified-node programme requires.

What changed per release is in the public changelog: https://docs.2kw.ai/changelog. Entries before npm publication (`0.1.0`–`0.3.0`) used the node's own numbering; `0.3.0` removed the Dataset resource.

## Build from source

`npm install && npm run build && npm pack` produces a tarball you can point n8n's community-node install dialog at, which is useful for testing an unreleased change.

## Local development with Docker Compose

The repository's `compose.yaml` includes an off-by-default n8n service under the `n8n` profile. It bind-mounts `./n8n/dist` and `./n8n/package.json` into the container's custom-node folder so a `npm run build` is all that's needed to pick up code changes.

```bash
cd n8n && npm install && npm run build      # build the package once
docker compose --profile n8n up -d n8n      # start n8n on http://localhost:5678
# iterate:
cd n8n && npm run build                     # after edits
docker compose --profile n8n restart n8n    # reload the bind-mounted dist
```

n8n's first launch asks you to create an owner account in the UI. After that, *Credentials → New → 2kw API* and *the* `2kw` *node* are immediately available.

## Smoke test (required before each release)

1. Build the package: `cd n8n && npm install && npm run build`.
2. Either install a locally packed tarball into your existing n8n, **or** start the local Docker n8n: `docker compose --profile n8n up -d n8n`.
3. Configure a `2kw API` credential pointing at a 2kw.ai dev environment with your API key.
4. Build a 2-node workflow: a manual trigger → 2kw (Schema → Get) using a known schema ID. Run it. Confirm the output JSON contains the schema definition.
5. Repeat with `Extraction → Run` against a small schema and a one-line `inputText`. Confirm the output contains a result object.

## Development

Source of truth is the `n8n/` directory of the backbone monorepo. `github.com/2kw-ai/n8n-nodes-2kw` is a **one-way mirror written only by release CI** — pull requests and direct commits there are overwritten by the next release. Report issues there; send patches against the monorepo.

```bash
cd n8n
npm install
npm run sync-types       # copy OpenAPI types from mcp/
npm run dev              # tsc --watch
npm test                 # vitest
npm run lint             # tsc --noEmit + n8n community-package scan
npm run scan             # the scan on its own
npm run build            # tsc + gulp icons
```

`npm run scan` runs n8n's own `@n8n/scan-community-package` rule set against this
working tree. Passing it is a requirement of n8n's verified-node programme, and
the published `npx @n8n/scan-community-package n8n-nodes-2kw` form of it only
accepts an already-published package — so this is the pre-merge equivalent, run
on the source the scanner would otherwise fetch from the mirror. Two consequences
worth knowing:

- **Tests live in `test/`, not next to the code.** The scanner lints
  `{nodes,credentials}/**` with inline configuration disabled, so a fixture like
  `{ name: 'prod (v9)', value: 'v-9' }` under `nodes/` is read as a node
  parameter and fails a naming rule that cannot be suppressed.
- **The timer globals are off limits.** Use `sleep` from `n8n-workflow` rather
  than `setTimeout`; n8n Cloud restricts them for community nodes.

Type drift check fails the build if `generated/openapi.d.ts` no longer matches `mcp/src/generated/openapi.d.ts`. Run `npm run sync-types` after any MCP regeneration. In a standalone checkout of the mirror there is no `mcp/` to compare against, so the check accepts the committed copy and the drift guard runs in the monorepo pipeline only.

The connect-pause decoder works the same way. `nodes/TwoKw/operations/connect-pause.ts` and `test/fixtures/connect-pause-cases.json` are copies of the CLI's `cli/src/lib/connect-pause.ts` and its golden fixture, so the CLI, the MCP server and this node read a paused run's connector requests by one rule. `npm test` runs `npm run check-connect-pause` first and fails when either copy has drifted; run `npm run sync-connect-pause` after changing the CLI's files, never edit the copies. The mirror has no `cli/` either, so there the check accepts the committed copies.
