# Character Variant Protocol Types

## Goal

Translate the character-variant copilot contract into concrete frontend and backend type definitions without yet changing the character editor UI into a full variant manager.

## Scope

1. Add backend TypedDict definitions for:
   - base character proposals
   - variant inherit rules
   - variant image-spec overrides
   - variant proposal collections
2. Extend copilot proposal parsing so the backend can accept:
   - `{"mode":"base_character","roles":[...]}`
   - `{"mode":"character_variant","base_character":{...},"variants":[...]}`
3. Extend frontend TypeScript types and SSE normalization so future variant payloads are strongly typed.

## Non-Goals

- No database schema changes yet
- No variant management UI yet
- No prompt rewrite for variant generation yet

## Design Rules

- `Character` remains the stable identity layer.
- `Variant` remains an override layer, not a second full character.
- Backend returns normalized snake_case payloads.
- Frontend exposes camelCase typed payloads for component consumption.

## Deliverables

- `/apps/backend/video_lab/domain/story_dev/copilot_types.py`
- `/apps/backend/video_lab/routes/copilot.py`
- `/apps/frontend/src/api.ts`

## Validation

1. Python compile of copilot route and typed payload module
2. Frontend production build
3. Full app restart via `./start.sh`
