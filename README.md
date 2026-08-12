# n8n-nodes-2kw

n8n community node for the [2kw.ai](https://2kw.ai) platform (engineering name: Backbone).

Use 2kw.ai inside n8n workflows: extract structured data with schemas, fetch and compile prompts, convert documents to markdown, transcribe audio, and append items to datasets.

## Installation

The package is published on npm as [`n8n-nodes-2kw`](https://www.npmjs.com/package/n8n-nodes-2kw).

**In n8n (recommended).** Open *Settings → Community Nodes → Install*, enter `n8n-nodes-2kw`, accept the community-node risk prompt, and confirm. n8n installs it from npm and the **2kw** node appears in the node picker.

**Manually into `~/.n8n/custom`.** `npm install n8n-nodes-2kw` inside `~/.n8n/custom/` and restart n8n. The node loader picks it up by the `n8n` field in `package.json`.

**From source.** `cd n8n && npm install && npm run build && npm pack` produces a tarball you can point the same install dialog at. Useful for testing an unreleased change.

Releases are cut from the backbone monorepo, so the package version tracks the platform version rather than counting up on its own — see "Versioning" below.

### Configure credentials

In n8n, open *Credentials → New → 2kw API* and provide:

- **Base URL:** `https://api.2kw.ai` (or your self-hosted Backbone URL)
- **API Key:** a personal access token created in the 2kw.ai dashboard under *Settings → API Keys*

n8n's credential test calls `GET /v1/models` against your base URL — if it succeeds, the key is valid.

## Usage

Drop the **2kw** node into a workflow. Pick a Resource and Operation.

Schema, Prompt, Schema Version, and Prompt Label fields are **searchable dropdowns** populated from the 2kw API on demand. Switch the field to **By ID** if you want to paste a UUID or use an n8n expression instead.

| Resource | Operation | Notes |
| --- | --- | --- |
| Schema | Get | Searchable picker. Returns schema metadata + active version. |
| Prompt | Get | Searchable picker. Returns prompt metadata. |
| Prompt | Compile | Compiles a prompt with a `Variables` JSON map. Optional `Version ID` (string) or `Label` (picker, depends on prompt). |
| Prompt | Resolve | Returns the active prompt content (no variable interpolation). Optional `Label` (picker, depends on prompt). |
| Extraction | Run | Sync or async-with-polling (toggle `Wait For Completion`, default on). `Schema` and `Schema Version` are searchable pickers. |
| Extraction | Get | Look up a previous extraction by ID. |
| Extraction | Estimate | Estimate token usage + recommended strategy without running. |
| Document | Convert | Multipart upload from a binary property. `Output Formats` selects which representations to include. Returns one item per converted document. |
| Document | Convert From Source | URL or base64 (no binary upload). Same `Output Formats` + per-document item split as Convert. Pipeline option: fast / ocr / vlm. |
| Transcription | Transcribe | Multipart audio upload. Required: `Model`. Optional: `Language`, `Prompt`, `Response Format`, `Temperature`. |

## Chat completions (via n8n's OpenAI node)

The 2kw API exposes an OpenAI-compatible `/v1/chat/completions` endpoint. To use chat models, embeddings, vision, tool calling, or n8n's AI Agent against 2kw, **use n8n's built-in OpenAI node** rather than this package — that gives you the full OpenAI surface for free.

Setup (one-time):

1. In n8n, *Credentials → New → OpenAI*.
2. **Base URL:** `https://api.2kw.ai/v1`
3. **API Key:** your 2kw PAT (the same key your `2kw API` credential uses).
4. Save.

After that, any n8n node that consumes an OpenAI credential — Chat Model, Embeddings, AI Agent, Tools — works against 2kw with no further setup. Use 2kw's `provider/model` format in the model field (e.g. `openai/gpt-4o-mini`).

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
3. Configure a `2kw API` credential pointing at dev backbone with your API key.
4. Build a 2-node workflow: a manual trigger → 2kw (Schema → Get) using a known schema ID. Run it. Confirm the output JSON contains the schema definition.
5. Repeat with `Extraction → Run` against a small schema and a one-line `inputText`. Confirm the output contains a result object.

## Versioning

The published version is the backbone platform version, stamped by release CI — the same scheme `@2kw/ai` (CLI) and `@2kw/ai-mcp-server` already use. The `version` field committed here is a placeholder and is never what ships.

The first npm release therefore jumps from the internal `0.3.0` to the platform's current major. There were no `1.x`–`4.x` releases of this node; the numbers are shared with the platform, not skipped.

Prereleases publish under the `dev` dist-tag (`npm install n8n-nodes-2kw@dev`), stable releases under `latest`.

## Changelog

Entries below `1.0.0` predate npm publication and use the node's own numbering.

### 0.3.0
- Resource locators for Schema, Prompt, Schema Version, Prompt Label (searchable dropdowns).
- Document conversion: `Output Formats` multi-select (`MD`, `TEXT`, `JSON`, `HTML`); response split into one n8n item per converted document.
- **Breaking:** removed Dataset resource. Workflows using `Dataset.AppendItem` will fail to load. Replace with a generic HTTP Request node hitting `POST /v1/datasets/{id}/versions/{versionId}/items`.

### 0.2.0
- Added Extraction.Get, Extraction.Estimate, Prompt.Resolve, Document.Convert From Source.
- Extraction.Run gained `Wait For Completion` toggle (default on) — submits to async + polls.

### 0.1.0
- Initial release: Schema.Get, Prompt.Get/Compile, Extraction.Run (sync), Document.Convert, Transcription.Transcribe, Dataset.AppendItem.

## Roadmap

- n8n verified-community-node submission.
- Trigger nodes (require backend webhook events).
- Async document conversion + Wait For Completion (sync covers most cases today).

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

## License

MIT — see [LICENSE](LICENSE). Note that this applies to the n8n node package only; the rest of the 2kw.ai platform is proprietary.
