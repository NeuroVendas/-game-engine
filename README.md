# Forge =] Engine

AI-first 3D game engine and editor.

Project Helios is the first benchmark game.

## v0.3

This branch is the first real modular Forge build.

Current pieces:

- TypeScript + Vite project
- Babylon.js 3D runtime
- editor viewport
- scene explorer
- property inspector
- move / rotate / scale gizmos
- add / delete entities
- scene export
- Play / Stop workflow
- third-person character controller
- WASD movement
- sprint + jump
- first/third-person camera toggle
- interactable objects
- scripted blast door
- scripted reactor pulse
- script runtime
- semantic scene JSON
- Forge AI structured operations
- Project Helios sample scene
- automated scene validation
- TypeScript checking
- production build CI

## Run locally

```bash
npm install
npm run dev
```

Then open the Vite URL.

## Validation

```bash
npm run check
npm run build
```

Forge CI runs validation and a production build on every push to the v0.3 branch.

## Controls

### Editor

- Click object: select
- W: Move gizmo
- E: Rotate gizmo
- R: Scale gizmo
- F: focus selected object
- Delete: delete selected object

### Play

- WASD: move
- Shift: run
- Space: jump
- E: interact
- C: toggle first/third-person camera
- Mouse: orbit camera
- Mouse wheel: zoom

## Architecture

```text
src/
├── ai/          AI-facing structured world operations
├── editor/      visual editor
├── engine/      runtime, scene loader, scripting
├── player/      character controller
└── types.ts     Forge scene schema

public/
└── scenes/      editable .forge.json scene files

scripts/
└── validate-scenes.mjs

docs/
└── AI_CONTRACT.md
```

## Core design rule

A human can use the visual editor.

A developer can use code.

An AI can use scene JSON + structured Forge operations.

All three edit the same project.

See `docs/AI_CONTRACT.md`.

## Roadmap

- v0.3: editor + player + scene schema + scripting foundation
- v0.4: real component inspector + script editor + prefabs
- v0.5: asset browser + UI editor + terrain
- v0.6: audio + physics expansion + save/load projects
- v0.7: multiplayer
- v0.8: accounts + profiles + friends
- v0.9: game publishing
- v1.0: Forge Platform


## Project documentation

Forge's product and engineering direction is recorded in the repository so future contributors and AI agents work from the same source of truth.

- docs/VISION.md — product identity and long-term goal
- docs/PRODUCT_PRINCIPLES.md — creator and UX principles
- docs/ARCHITECTURE.md — current technical architecture
- docs/ROADMAP.md — milestone direction from v0.3 to v1.0
- docs/STYLE_GUIDE.md — Forge visual and editor identity
- docs/AI_CONTRACT.md — rules for AI-editable worlds
- docs/PROJECT_HELIOS.md — benchmark game direction
- docs/DECISIONS.md — accepted product/architecture decisions
- CONTRIBUTING.md — contributor workflow
- AGENTS.md — instructions for AI coding agents

For major changes, read the relevant documents before writing code.
