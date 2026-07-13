# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MCP (Model Context Protocol) server exposing the Civitai REST API (`https://civitai.com/api/v1`) as 25 tools over stdio transport. TypeScript, ES modules (`"type": "module"`), Node 18+.

## Commands

```bash
npm run build              # tsc → dist/
npm run dev                # tsc --watch
npm start                  # node dist/index.js (runs the MCP server on stdio)
node test.js               # smoke test against the live Civitai API (requires build first)
node comprehensive-test.js # full live-API test suite with per-test 5s timeouts
```

There is no test framework — `npm test` is a stub. Both test scripts import from `dist/`, so **always `npm run build` before running them**. They hit the live API (no mocks), so failures can be network/rate-limit related.

## Architecture

Three files in `src/`, layered:

- **`types.ts`** — Zod schemas for every Civitai API response, plus inferred TS types. Every API response is validated with `schema.parse()` at runtime, so schema strictness is the main source of runtime failures: the real API is inconsistent (fields go missing, come back null, or change type — e.g. `nsfwLevel` is sometimes a string enum, sometimes a number; `nextCursor` is string or number). The prevailing fix pattern (see git history) is loosening schemas with `.optional()`, `.nullable()`, `z.union()`, or expanding enums to match what the API actually returns.
- **`civitai-client.ts`** — `CivitaiClient`, a thin typed fetch wrapper. `buildUrl()` serializes params (arrays become repeated query params); `makeRequest()` fetches and validates. The API key comes from the `CIVITAI_API_KEY` env var and is sent **only** via the `Authorization: Bearer` header — never put it in URLs/query params, since URLs surface in tool output and logs (this includes `getDownloadUrl()`, which intentionally returns an unauthenticated URL).
- **`index.ts`** — `CivitaiMCPServer`: tool definitions (JSON Schema, hand-written — not derived from the Zod schemas) and handlers that call the client and format results as markdown-ish text. Errors are caught and returned as text content, never thrown to the transport.

When adding or changing a model-type or file-format enum, it must be updated in **two places**: the Zod enum in `types.ts` and the inline JSON Schema `enum` arrays in `index.ts` tool definitions (`search_models` and `get_models_by_type` both list model types).

## Verifying changes

`npm run build` catches type errors; to verify behavior, run `node comprehensive-test.js` against the live API. Zod validation errors in tool output usually mean the API's actual response drifted from a schema in `types.ts`, not a bug in the client logic.

## Rules

@.claude/rules/zod-schemas.md
@.claude/rules/security.md
