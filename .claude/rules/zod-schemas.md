# Zod schema strictness

The Civitai API is inconsistent: fields go missing, come back `null`, or
change type between calls (e.g. `nsfwLevel` is sometimes a string enum,
sometimes a number; `nextCursor` is string or number). Every response is
validated at runtime with `schema.parse()` in `src/civitai-client.ts`, so a
schema that's too strict is the main source of runtime failures — not a bug
in client logic.

- When `comprehensive-test.js` reports a Zod validation error, the fix is
  almost always to loosen the schema in `src/types.ts`: add `.optional()`,
  `.nullable()`, wrap in `z.union([...])`, or widen an enum to include the
  value the API actually returned. Don't add defensive code in
  `civitai-client.ts` or `index.ts` to work around a strict schema — fix the
  schema.
- Before loosening a schema, confirm the value in the actual API response
  (rerun the failing test, or fetch the endpoint directly) rather than
  guessing the shape.

## Dual-update enum rule

`ModelType` and `FileFormat` each exist in **two** places that must stay in
sync:

1. The Zod enum in `src/types.ts` (`ModelType`, `FileFormat`).
2. The inline JSON Schema `enum` arrays in `src/index.ts` tool definitions —
   currently `search_models` (~line 130) and `get_models_by_type` (~line
   330) for `ModelType`.

Changing one without the other means the tool's declared JSON Schema
disagrees with what the Zod layer will accept — update both in the same
change. Use `/add-enum` to do this without missing a spot.
