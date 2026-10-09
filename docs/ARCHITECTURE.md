# Forge =] Architecture

## Goal

Forge has three first-class authoring paths:

1. visual Studio
2. creator code
3. structured AI operations

All converge on the same canonical project representation.

## Current stack

Package version: `0.5.0`.

- TypeScript
- Vite
- Babylon.js + loaders
- Supabase
- Playwright
- GitHub Actions
- `forge.scene` JSON

## System boundaries

### Platform shell

`src/main.ts` coordinates launcher/platform and transitions into Studio/Play.

`src/platform/PlatformStore.ts` owns local browser-first platform state.

`src/platform/CloudStore.ts` owns Supabase-backed identity, projects, catalog, favorites, recents, profiles and Friends behavior.

### Studio

`src/editor/EditorApp.ts` owns selection, Explorer, Properties, transform tools, hierarchy, asset import, environment controls, script editor, history, persistence and Play/Stop transition.

### Engine/runtime

`src/engine/ForgeEngine.ts` owns scene instantiation, primitives/models, materials/textures, environment, lights, sound/UI/runtime entities, parenting, collision, shadows and script attachment.

### Scripting

`src/engine/ScriptRuntime.ts` owns creator script execution/lifecycle and Forge APIs.

Script kinds:

- Script
- LocalScript
- ModuleScript

### Player

`src/player/PlayerController.ts` owns avatar, movement, camera, jump, interaction and player state.

### AI

`src/ai/ForgeAI.ts` owns structured AI operations. AI should not rely on fake editor mouse automation.

## Scene documents

Canonical format: `forge.scene v1`.

Goals:

- stable IDs
- semantic names
- explicit components
- hierarchy
- deterministic serialization
- portable data
- readable diffs
- AI addressability

Schema lives in `src/types.ts`.

## Entity/component model

Entities contain transform/size, appearance, optional asset metadata, components and parentId.

Current components:

- Collider
- Interactable
- Door
- Clearance
- PowerConsumer
- Reactor
- Script
- Light
- Sound
- UI
- Model
- Spawn

## Hierarchy

Stored through `parentId`.

Rules:

- no cycles
- reparent preserves world transform
- Explorer drag/drop edits the same parentId data
- Group uses the ordinary entity model
- dropping to Workspace unparents

## Rendering

Babylon.js currently handles:

- gradient/custom sky
- ambient/fog
- lights
- material presets
- textures
- emissive/transparency
- shadows

Optional renderer features must fail gracefully.

## Imported assets

Current import path:

- GLB
- images/textures
- audio
- sky images

Production UGC still needs a proper hosted asset pipeline.

## Scripting model

Current capabilities include lifecycle, interaction, input/events, UI events, modules/require, world access, runtime create/clone/destroy, audio/UI, player/camera and output logging.

Current creator scripts are trusted code, not a hardened hostile-code sandbox.

## Editor/runtime boundary

Play flow:

1. snapshot authoring scene
2. instantiate runtime
3. start player/scripts
4. allow runtime mutations
5. Stop destroys runtime-only state
6. restore authoring state

Runtime changes do not silently mutate source.

## Platform/cloud boundary

Guests remain able to create/play locally.

Cloud adds identity, ownership, sync, publishing and social state.

## Security

Supabase RLS is the platform data boundary. Do not bypass ownership/security assumptions client-side.

## Validation pipeline

```text
EDIT
-> VALIDATE
-> TYPECHECK
-> BUILD
-> BROWSER SMOKE
-> CLOUD SMOKE when relevant
-> PREVIEW
-> REVIEW
```

Project Helios remains the primary game pressure test.
