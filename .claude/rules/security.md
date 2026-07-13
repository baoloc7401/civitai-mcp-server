# API key handling

`CIVITAI_API_KEY` (from the environment) must only ever be sent via the
`Authorization: Bearer` header, set in `makeRequest()` — there are **two** of
these, one in `src/civitai-client.ts` and one in `src/orchestration-client.ts`
(duplicated by design; keep their semantics in sync by hand). Never put the
key in a URL or query parameter.

- `buildUrl()` (in both clients) must never append the API key as a query
  param.
- `getDownloadUrl()` intentionally returns an **unauthenticated** URL — this
  is by design, not a bug, because tool output and logs can surface URLs
  verbatim. Don't "fix" it by adding the key back in.
- If a new endpoint needs auth, thread the key through the existing
  `Authorization` header path in the relevant client's `makeRequest()`, not a
  bespoke one.

# Buzz spending (Orchestration API)

Orchestration tools that spend Buzz (`generate_image`, `generate_video`,
`upscale_image`, `enhance_prompt`, `submit_workflow`) MUST default to a
`whatif=true` dry-run and only execute for real when the caller passes
`confirmSpend: true`. The gate lives in the `src/index.ts` handlers
(`const dryRun = args.confirmSpend !== true`).

- Never remove or invert the gate, and never default `confirmSpend` to true.
- New spend tools must follow the same pattern and carry the same
  "COSTS BUZZ … dry-run by default" wording in their description.
- Tests and probe scripts must only ever use `whatif: true` and must never
  pass `confirmSpend`.
- Real submissions must never be auto-retried (a replay charges Buzz twice);
  only `whatif` dry-runs opt into `retryable: true`.

# Error handling

Handlers in `src/index.ts` catch errors from `CivitaiClient` /
`CivitaiOrchestrationClient` calls and return them as text content in the
tool result — they never throw to the MCP transport. Keep new tool handlers
consistent with this: wrap client calls in try/catch and format failures as
readable text, don't let exceptions propagate.
