---
description: Run the live-API test suite, diagnose any Zod validation failures against the actual response shape, and propose schema fixes
---

1. `npm run build`, then `node comprehensive-test.js`.
2. For each Zod validation error in the output, identify the failing schema
   in `src/types.ts` and the field(s) that didn't validate.
3. Reproduce the actual API response for that endpoint (rerun the specific
   failing call, or use the `civitai` MCP tools if available) to see the
   real shape of the offending field.
4. Propose the minimal schema loosening that fits the real response —
   `.optional()`, `.nullable()`, `z.union([...])`, or widening an enum —
   per `.claude/rules/zod-schemas.md`. Don't work around it with defensive
   code in `civitai-client.ts` or `index.ts`.
5. Apply the fix, rebuild, and rerun the specific failing test to confirm.

If a failure looks like a timeout or rate-limit rather than a shape
mismatch, say so and don't touch the schema.
