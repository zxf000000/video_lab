# ExecPlan: Character Image Spec Completion

## Goal

Complete the remaining character workflow so the editor can derive `image_spec` from the current character setup, then use that latest visual state for image generation.

## Scope

- Add a one-click action in the character editor to generate `image_spec`
- Persist the current editor form before generating a character image
- Tighten spacing in high-frequency dialogs to use screen space more efficiently

## Validation

- `npm run build`
- `./start.sh`
- Verify character editor can:
  - generate `image_spec`
  - generate image from latest edited state
  - render more compact dialog layout
