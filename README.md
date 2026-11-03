# n8n-nodes-2kw

The **2kw** node for [n8n](https://n8n.io) brings [2kw.ai](https://2kw.ai) into your workflows: run your 2kw.ai agents and handle their approvals, extract structured data with your schemas, fetch and compile prompts, convert documents to Markdown, text, JSON or HTML, and transcribe audio.

Full documentation: [docs.2kw.ai/integrations/n8n](https://docs.2kw.ai/integrations/n8n).

## Installation

The package is published on npm as [`n8n-nodes-2kw`](https://www.npmjs.com/package/n8n-nodes-2kw).

**In n8n (recommended).** Open *Settings → Community Nodes → Install*, enter `n8n-nodes-2kw`, accept the community-node prompt, and confirm. The **2kw** node then appears in the node picker.

**Manually (self-hosted n8n).** Run `npm install n8n-nodes-2kw` inside `~/.n8n/custom/` and restart n8n.

## Credentials

You need a 2kw.ai account and an API key. Create one under **API Keys** in the 2kw.ai dashboard.

In n8n, open *Credentials → New → 2kw API* and set:

- **Base URL:** `https://api.2kw.ai`. Keep the default unless 2kw.ai gave you a dedicated API address.
- **API Key:** the key you created.

n8n tests the credential with `GET /v1/models`. If the test passes, the key is valid.

## Example workflow

This workflow extracts an invoice number, a date and a total from a line of text with one of your schemas. Copy the JSON, paste it into an empty n8n canvas (Ctrl+V or Cmd+V), pick your **2kw API** credential on the 2kw node, and replace the schema ID with one of yours, or switch the **Schema** field to **From List** and pick one.

```json
{
  "name": "2kw: extract invoice fields",
  "nodes": [
    {
      "parameters": {},
      "name": "When clicking 'Execute workflow'",
      "type": "n8n-nodes-base.manualTrigger",
      "typeVersion": 1,
      "position": [0, 0]
    },
    {
      "parameters": {
        "resource": "extraction",
        "operation": "run",
        "schema": {
          "__rl": true,
          "mode": "id",
          "value": "78af6e26-30b4-4677-bb3f-a2494444380c"
        },
        "model": "openai/gpt-4o",
        "inputText": "Invoice INV-2026-0042 dated 3 November 2026, total EUR 1,250.00"
      },
      "name": "2kw",
      "type": "n8n-nodes-2kw.twoKw",
      "typeVersion": 2,
      "position": [220, 0]
    }
  ],
  "connections": {
    "When clicking 'Execute workflow'": {
      "main": [[{ "node": "2kw", "type": "main", "index": 0 }]]
    }
  }
}
```

Run it: the 2kw node returns the extraction with its `result` object, shaped by your schema.

## Usage

Drop the **2kw** node into a workflow. Pick a Resource and Operation.

Agent, Label, Schema, Prompt, Schema Version, and Prompt Label fields are **searchable dropdowns** populated from the 2kw API on demand. Switch a field to its manual mode (**By ID**, **By ID or Name**, or **By Name**) to paste a value or use an n8n expression instead.

| Resource | Operation | Notes |
| --- | --- | --- |
| Agent | Decide Approval | Approves or rejects every pending approval of a paused run and continues it. Required: `Agent`, `Response ID`, `Decision` (`Approve All` / `Reject All`, default reject). Optional: `Label` (the one the run used), `Reason`, `Remember for Conversation` (approvals only). Options: `Mode`, `Return Paused Runs`, `Simplify Output`. See [Human approval from a workflow](#human-approval-from-a-workflow). |
| Agent | Send Message | Runs one turn of a stored agent. `Agent` and `Label` are pickers (empty label = latest). Options: `Binary Properties` (comma-separated, uploaded as attachments), `Conversation ID`, `Mode`, `Previous Response ID`, `Return Paused Runs`, `Simplify Output`. Fails if the agent pauses unless `Return Paused Runs` is on — see [Agents in n8n](#agents-in-n8n). |
| Schema | Get | Searchable picker. Returns schema metadata + active version. |
| Prompt | Get | Searchable picker. Returns prompt metadata. |
| Prompt | Compile | Compiles a prompt with a `Variables` JSON map. Optional `Version ID` (string) or `Label` (picker, depends on prompt). |
| Prompt | Resolve | Returns the active prompt content (no variable interpolation). Optional `Label` (picker, depends on prompt). |
| Extraction | Run | Sync or async-with-polling (toggle `Wait For Completion`, default on). `Schema` and `Schema Version` are searchable pickers. |
| Extraction | Get | Look up a previous extraction by ID. |
| Extraction | Estimate | Estimate token usage + recommended strategy without running. |
| Document | Convert | Multipart upload from a binary property. `Output Formats` selects which representations to include. Returns one item per converted document. |
| Document | Convert From Source | URL or base64 (no binary upload). Same `Output Formats` + per-document item split as Convert. Pipeline option: Fast, Scanned Documents or Complex Layouts. |
| Transcription | Transcribe | Multipart audio upload. Required: `Model`. Optional: `Language`, `Prompt`, `Response Format`, `Temperature`. |

## Agents in n8n

**Agent › Send Message** runs one turn of an agent you built in 2kw and returns its answer as `text`, together with `commentary` (what the agent said on its way to a tool call, one string per message, oldest first; when a run pauses before it answers, `text` is empty and what it said so far is here), `status`, `responseId`, `conversationId`, `conversationMode`, `model`, `usage` and `components`, the tables and charts the agent showed (each with `id`, `callId`, `component`, `schemaVersion` and `props`; empty when none). `conversationMode` is the [conversation mode](#conversation-mode) the turn ran under: `plan`, `ask`, `auto`, or `null` when none is set. Pass `conversationId` (or `responseId` as *Previous Response ID*) to a later Send Message to continue the thread. Files from binary properties are uploaded and attached to the message; images reach the model as pixels.

This is node version 2, the default for a node you add now. A version 1 node, one added to a workflow before version 2 existed, returns every assistant message of the turn in `text`, joined by a blank line, commentary included; it returns `commentary` as well. In 7.3.0 a version 1 node returned the answer alone; from the release with version 2 on, it joins again. To get the answer alone, replace the workflow's 2kw node with a new one.

**n8n runs agents unattended by default.** When an agent's policy wants a human to approve a tool call, the run pauses and this operation fails with the tools that are waiting, for example `Agent paused for approval: create_invoice (apreq_…)`. To ask a person instead, see [Human approval from a workflow](#human-approval-from-a-workflow). For agents you call from n8n, use tools their policy lets run without a human decision — once auto-approval is available, set `classes.write` to `auto` in the agent's policy. A run that asks for a client-side tool fails the same way (`Agent requested client-side tool …`), because n8n cannot execute it. A run that stops early (`status: incomplete`, e.g. too many tool iterations) is returned, not failed; check `incompleteReason`. Leave *Retry On Fail* off for agents with write tools: a timed-out turn may still be running, and a retry repeats its tool calls.

### Conversation mode

The **Mode** option of Send Message and Decide Approval sets the conversation's mode, which narrows what the agent may do without touching the agent:

- **Plan**: read only. Anything that could change something is refused.
- **Ask**: no automatic approver. Calls that need approval wait for a person.
- **Auto**: the operator's policy as written, automatic approver included.

Leave the option out to keep the conversation's mode; the node then sends nothing. Once added, it defaults to `Ask`, and the node appends a `backbone:mode` item to the request. The mode is stored on the conversation and applies to its later turns too. A mode only tightens the agent's policy, never loosens it. See [Conversation Mode](https://docs.2kw.ai/agents#conversation-mode) in the API docs.

### Human approval from a workflow

To put a person in the loop instead of failing, turn on **Return Paused Runs** in Send Message. A run that pauses for approval then comes out as an item with `status: requires_action`, its `responseId`, and `pendingApprovals` — one entry per waiting call, with `approvalId`, `tool`, `arguments`, `policyClass` and `reason` (why the auto-approver escalated it, or `null`). Route on a non-empty `pendingApprovals` with an IF node, not on `status` alone (a run waiting for a connector's question has the same status and is answered in chat, see below), ask a person with any Send-and-Wait node (Slack, email, Telegram), and pass the answer to **Agent › Decide Approval**:

- **Agent** and **Label**: the same agent and label the run used. The platform resolves the approved calls' tools from the continued version.
- **Response ID**: `{{ $json.responseId }}` from the paused item.
- **Decision**: `Approve All` or `Reject All`, or an expression returning `approve` or `reject`. It applies to every pending approval of the response; the platform accepts a continuation only when all of them are decided.
- **Reason**: optional. It is recorded on each decision, and on a rejection the agent reads it.
- **Remember for Conversation**: approvals only. Later calls of the same tools in this conversation run without asking. Destructive tools are approved once and never remembered.

Decide Approval reads the pending approvals from `GET /v1/agents/{agentId}/approvals?status=pending`, sends one `backbone:approval_response` per approval on `POST /v1/responses` with `previous_response_id`, and returns the continued run in Send Message's output shape. A continued run can pause again; with Return Paused Runs on it comes out the same way, so a loop back to the person works.

It fails the item when:

- nothing is pending on the response: already decided by a person, a conversation grant or the auto-approver, or the ID is not a paused run of this agent;
- the platform refuses the decision, for example because an approval was decided automatically (`2kw refused the decision on response …`) or is no longer pending;
- the conversation is in Plan and an approval is not read-only (`conversation_in_plan_mode`). The approval stays pending. Setting Mode to `Ask` on the same Decide Approval leaves Plan and approves in one request; leaving Plan is the person's decision, so ask them first;
- the continued run asks for a client-side tool, which n8n still cannot execute. A turn can wait for approvals and a client-side tool at once; deciding the approvals does not run the client-side tool.

Approvals remain a human decision. Do not give Decide Approval to an AI Agent as a tool, and do not wire it to approve without asking someone. For tools that should run without a person, set `classes.write` to `auto` in the agent's policy once auto-approval is available.

### Connectors that need a person's sign-in

An agent can use an MCP connector that acts as a person, through their own OAuth sign-in. When nobody is connected yet, or the agent is not yet allowed to use the connection, the run pauses with a `backbone:connector_auth_request` item instead of calling the connector. n8n cannot sign in for anyone, so by default the item fails with `Agent paused until you connect <label> (<host>) in https://chat.2kw.ai/connectors`. The error says *allow the agent to use* instead of *connect* when the connection exists but this agent is not allowed yet, and *reconnect* when the sign-in expired.

To handle the pause in the workflow, turn on **Return Paused Runs**. The paused item then carries `pendingConnections`, one entry per connector: `serverLabel`, `host`, `reason` (`connect`, `allow` or `reconnect`), `destinations` (the hosts an allow is asked for again, or `null`) and `connectUrl`, the Connectors page of chat.2kw.ai that belongs to the credential's base URL. Send the person the link, wait until they have connected, then continue the run with **Send Message** and **Previous Response ID** `{{ $json.responseId }}`; the message can be anything, for example "connected". The platform checks the connection again on that turn: if the person connected, the agent goes on; if not, it is told so and may ask once more. Never answer the connect call yourself.

### Connectors that ask the user a question

A connector can ask the person who started the run something in the middle of a call: pick one of two matching customers, fill in a missing field, or confirm a step on the service's own page. Only that person can answer, and only in chat.2kw.ai, so by default the item fails with `<label> needs the user's input — answer in chat: https://chat.2kw.ai/c/<conversationId>`. With **Return Paused Runs** on, the paused item carries `pendingInputs`, one entry per question: `inputRequestId`, `serverLabel`, `tool`, `mode` (`form`, `url`, `mixed` or `unknown`) and `answerUrl`, the conversation to answer in. Send the person the link; the run continues in chat once they answer. The simplified output never carries the question itself. A question outranks every other pause: when the same run also waits for an approval or a connection, the item fails (or is returned) for the question with `pendingApprovals` and `pendingConnections` empty, and the answer in chat resolves the rest. Neither Decide Approval nor Send Message continues a run that waits for a question.

**Using n8n's OpenAI node instead.** With the OpenAI credential set up as below, *OpenAI › Message a Model* (n8n 1.117 or later) can call an agent too: pick the model **By ID** and enter `agent/<name>` or `agent/<name>@<label>`. That is fine for text-only turns with agents that never pause. It cannot attach files, and its default *Simplify* setting hides a paused run — the workflow receives empty output and carries on. The OpenAI *Chat Model* inside n8n's AI Agent is not supported for agents yet. With a streaming trigger it requests streaming, which the 2kw Responses API now answers with Server-Sent Events, but that node has not been verified against agent turns.

## Chat completions (via n8n's OpenAI node)

The 2kw API exposes an OpenAI-compatible `/v1/chat/completions` endpoint. To use chat models, embeddings, vision, tool calling, or n8n's AI Agent against 2kw, **use n8n's built-in OpenAI node** rather than this package — that gives you the full OpenAI surface for free.

Setup (one-time):

1. In n8n, *Credentials → New → OpenAI*.
2. **Base URL:** `https://api.2kw.ai/v1`
3. **API Key:** your 2kw PAT (the same key your `2kw API` credential uses).
4. Save.

After that, any n8n node that consumes an OpenAI credential — Chat Model, Embeddings, AI Agent, Tools — works against 2kw with no further setup. Use 2kw's `provider/model` format in the model field (e.g. `openai/gpt-4o-mini`).

## Documentation

Every operation, its parameters and the agent features are described at [docs.2kw.ai/integrations/n8n](https://docs.2kw.ai/integrations/n8n). What changed in each release: [docs.2kw.ai/changelog](https://docs.2kw.ai/changelog).

## License

MIT — see [LICENSE](LICENSE). Note that this applies to the n8n node package only; the rest of the 2kw.ai platform is proprietary.
