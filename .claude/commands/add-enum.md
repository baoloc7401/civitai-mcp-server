---
description: Add or change a value in the ModelType or FileFormat enum across all locations that must stay in sync
argument-hint: <ModelType|FileFormat> <value-to-add-or-change>
---

The user wants to update an enum: $ARGUMENTS

`ModelType` and `FileFormat` each live in multiple places that must be kept
in sync (see `.claude/rules/zod-schemas.md`). Update **all** of the
following in one change:

1. `src/types.ts` — the `ModelType` or `FileFormat` Zod enum definition.
2. `src/index.ts` — every inline JSON Schema `enum` array for that type.
   For `ModelType` this currently means the `search_models` tool definition
   and the `get_models_by_type` tool definition (grep for the enum's current
   value list to find every occurrence — don't rely on a fixed line number).

After editing, run `npm run build` to confirm no type errors, then grep both
files for the enum name to confirm every list matches exactly (same values,
same order isn't required but the value sets must be identical).
