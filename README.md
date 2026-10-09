# Forge =] Engine + Platform

Forge =] is an AI-first 3D game engine, creator Studio, runtime and social game platform.

It combines approachable classic creation with modern TypeScript/Babylon.js rendering, creator scripting, imported assets, real browser testing and a Supabase-backed platform.

Project Helios is the first benchmark game.

## Continue current development

> **Forge v0.5.0 is merged into `main`.** [Release PR #27](https://github.com/NeuroVendas/-game-engine/pull/27) passed CI, Cloud Smoke and **two independent complete 16/16 browser suites**.
>
> **AI/Work/developer:** read [`CONTINUE_HERE.md`](CONTINUE_HERE.md) and [`AGENTS.md`](AGENTS.md). New development must branch from current `main`; old `forge-v0.5` and the #13–#26 stack are historical.
>
> A deployed preview is separate from the git release; check the preview workflow before claiming a live website.

> Current package version: **0.5.0**
>
> `forge-v0.5` is the historical root of the active v0.5 creator-quality stack.
>
> `forge-v0.4` is retained as the historical platform/creator-foundation branch.

## What works now

### Platform

- Home / Games / Favorites / Friends / Develop
- guest/local-first use
- accounts/cloud profiles
- cloud project sync
- private/unlisted/public projects
- public catalog
- favorites/recent plays
- creator profiles
- friend requests
- game details/deep links
- direct Play
- project create/edit/duplicate/rename/delete

### Studio

- Explorer hierarchy + drag/drop parenting
- Properties
- Move / Rotate / Resize
- snapping
- undo/redo
- primitives + semantic prefabs
- Groups
- materials/transparency/textures/emissive
- Spawn / Light / Sound / UI
- Script / LocalScript / ModuleScript
- GLB/image/audio/sky import
- environment/fog/sky
- save/load/import/export
- persistent Output

### Runtime

- Forge Classic avatar
- improved movement/jump feel
- environment + shadows with fallback
- typed scripting/modules
- UI/audio/player/camera/world APIs
- runtime create/clone/destroy

## Run locally

```bash
npm install
npm run dev
```

## Verify

```bash
npm run check
npm run build
npm run test:browser
npm run test:cloud
```

A successful build alone is not considered proof that runtime/editor behavior works.

## Controls

### Studio

- left click: select/manipulate
- WASD: move editor camera
- right mouse drag: orbit/look
- wheel: zoom
- F: focus selected
- Delete: delete
- toolbar: Select / Move / Resize / Rotate

### Play

- WASD: move
- Shift: run
- Space: jump
- E: interact
- C: first/third-person toggle
- mouse/wheel: camera

## Architecture

```text
src/
├── ai/
├── editor/
├── engine/
├── platform/
├── player/
└── types.ts

public/scenes/
scripts/
tests/
docs/
```

## Core rule

Visual editor, creator code and AI all edit the same canonical project.

## Documentation

Start with:

- `CONTINUE_HERE.md` — live continuation point, active branch/PR stack, failing checks and next work
- `docs/CURRENT_STATE.md` — current capability/limitation inventory
- `docs/PROJECT_HISTORY.md` — history from repository creation onward
- `docs/RECOVERY.md` — disaster-recovery/handoff guide
- `docs/VISION.md`
- `docs/PRODUCT_PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `docs/STYLE_GUIDE.md`
- `docs/AI_CONTRACT.md`
- `docs/PROJECT_HELIOS.md`
- `docs/DECISIONS.md`
- `CONTRIBUTING.md`
- `AGENTS.md`

## Product loop

```text
CREATE -> SCRIPT -> PLAYTEST -> PUBLISH -> PLAY WITH OTHERS -> ITERATE
```

Monetization is intentionally not the early focus.
