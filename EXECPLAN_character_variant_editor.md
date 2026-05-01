# Character Variant Editor

## Goal

Upgrade the character editor from a single-image-spec form into a three-part structure:

1. default/base variant
2. variant list
3. current variant detail

without adding a new database table.

## Storage Strategy

Persist variant data inside `characters.visual_profile`:

- `baseImageSpec`
- `defaultImagePath`
- `activeVariantId`
- `variants[]`

Keep legacy top-level visual fields mirrored to the currently active variant so existing generation code can keep working during migration.

## Scope

- Character editor UI refactor
- Persist/load variant data through existing `visualProfile`
- Generate image against the active variant
- Write generated image path back to the active variant or default variant

## Non-Goals

- No separate `character_variants` table yet
- No multi-variant list on the project card grid yet
- No variant-aware shot binding yet

## Validation

1. Frontend build
2. Backend py_compile
3. Restart with `./start.sh`
