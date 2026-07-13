# API key handling

`CIVITAI_API_KEY` (from the environment) must only ever be sent via the
`Authorization: Bearer` header, set in `makeRequest()` in
`src/civitai-client.ts`. Never put it in a URL or query parameter.

- `buildUrl()` must never append the API key as a query param.
- `getDownloadUrl()` intentionally returns an **unauthenticated** URL — this
  is by design, not a bug, because tool output and logs can surface URLs
  verbatim. Don't "fix" it by adding the key back in.
- If a new endpoint needs auth, thread the key through the existing
  `Authorization` header path in `makeRequest()`, not a bespoke one.

# Error handling

Handlers in `src/index.ts` catch errors from `CivitaiClient` calls and
return them as text content in the tool result — they never throw to the
MCP transport. Keep new tool handlers consistent with this: wrap client
calls in try/catch and format failures as readable text, don't let
exceptions propagate.
