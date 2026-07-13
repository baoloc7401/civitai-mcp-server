---
description: Build the server and run both live-API test scripts, then summarize failures
---

Run this repo's verification sequence and report results:

1. `npm run build` — if this fails, stop and report the TypeScript errors; don't run the test scripts against a stale `dist/`.
2. `node test.js` — the smoke test.
3. `node comprehensive-test.js` — the full live-API suite (per-test 5s timeout).

Both test scripts hit the live Civitai API with no mocks, so failures can be
transient (network blips, rate limiting) rather than real regressions. For
each failure:

- If it's a Zod validation error, treat it per `.claude/rules/zod-schemas.md`
  — the schema in `src/types.ts` is probably too strict for what the API
  actually returned, not a client bug.
- If it's a timeout, connection error, or HTTP 429, note it as likely
  transient rather than a code issue, and suggest rerunning.
- Otherwise, report it plainly with the failing tool/endpoint name.

End with a short pass/fail summary, not a full log dump.
