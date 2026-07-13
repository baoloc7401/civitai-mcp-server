---
name: add-civitai-tool
description: Add a new MCP tool wrapping a Civitai REST API endpoint (site API or Orchestration API) to civitai-mcp-server, end-to-end across the layered source files. Use when the user wants to expose a new Civitai API endpoint as a tool, e.g. "add a tool for X", "wrap the /images endpoint", "add support for Civitai's Y API".
---

# Add a new Civitai API tool

This repo (`src/`) has two layered client stacks that share one `index.ts`:

- **Site API** (`https://civitai.com/api/v1`, browsing/metadata):
  `src/types.ts` + `src/civitai-client.ts`
- **Orchestration API** (`https://orchestration.civitai.com`, paid
  generation): `src/orchestration-types.ts` + `src/orchestration-client.ts`

Pick the stack that matches the endpoint; the steps below are the same for
both (schemas file → client file → `index.ts`). Orchestration-specific
notes:

- Every Orchestration endpoint requires auth — call `this.requireAuth()`
  first in new client methods.
- If the endpoint **spends Buzz**, the tool MUST follow the confirmSpend
  gate in `.claude/rules/security.md`: handler runs `whatif: true` unless
  `args.confirmSpend === true`, and the description carries the
  "COSTS BUZZ … dry-run by default" wording (copy it from `generate_image`).
- Generation-style steps should go through
  `CivitaiOrchestrationClient.runStep('$type', input, opts)` (single-step
  workflow via `POST /v2/consumer/workflows`) rather than the `/recipes/*`
  endpoints — only the workflows endpoint returns whatif cost estimates and
  a pollable workflow id.

## 1. `src/types.ts` (or `src/orchestration-types.ts`) — response schema

Add a Zod schema for the endpoint's response shape, plus any new enums it
needs. Look at the actual Civitai API response (docs or a live call) before
writing the schema — but per `.claude/rules/zod-schemas.md`, default to
permissive (`.optional()`, `.nullable()`) on fields you're not sure are
always present, since this API is known to be inconsistent. Export the
inferred TS type alongside the schema, matching the existing
`ModelSchema` / `Model` pattern.

## 2. `src/civitai-client.ts` (or `src/orchestration-client.ts`) — client method

Add a method on `CivitaiClient` / `CivitaiOrchestrationClient` following the
existing pattern:

```ts
async getThing(id: number): Promise<Thing> {
  const url = this.buildUrl(`/things/${id}`);
  return this.makeRequest<Thing>(url, ThingSchema);
}
```

- Use `buildUrl(path, params?)` for query params — it handles arrays as
  repeated params automatically. Never hand-build query strings and never
  put the API key in the URL (see `.claude/rules/security.md`) —
  authentication happens automatically inside `makeRequest()` via the
  `Authorization` header.
- If the endpoint requires auth, don't add key handling here; `makeRequest()`
  already attaches it when `this.apiKey` is set. If the endpoint is
  meaningless without auth, throw a clear error like the existing
  `'This endpoint requires CIVITAI_API_KEY to be set.'` pattern.

## 3. `src/index.ts` — tool definition, handler, and dispatch

Three additions, all needed:

1. A case in the `switch (name)` block inside `setupToolHandlers()`
   dispatching to a new private handler method.
2. The handler method itself (`private async getThing(args: any) { ... }`)
   — call the client method, format the result as readable markdown-ish
   text (see `searchModels`/`getModel` for the formatting style — headers,
   bold labels, `.toLocaleString()` for counts), and return
   `{ content: [{ type: 'text', text: ... }] }`. Don't throw from inside
   the handler — the outer try/catch in `setupToolHandlers()` already
   formats thrown errors as text, but prefer handling expected failure
   cases explicitly.
3. A `Tool` entry appended to the array returned by `getTools()`: `name`,
   `description`, and a hand-written JSON Schema `inputSchema` (this is
   **not** derived from the Zod schema — write it separately, matching the
   parameter names your handler reads off `args`). If any parameter reuses
   an existing enum (model type, file format, sort order, etc.), copy the
   exact value list from an existing tool definition — don't paraphrase it,
   and if you're introducing a genuinely new enum value, see
   `.claude/rules/zod-schemas.md` on keeping `types.ts` and `index.ts` in
   sync.

## 4. Verify

Run `/build-test` (or manually: `npm run build`, then `node
comprehensive-test.js`) and confirm the new tool responds correctly. Add a
case for it in `comprehensive-test.js` if that file tests tools by name —
check its structure first.
