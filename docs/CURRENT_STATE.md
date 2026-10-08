# Forge =] Current State

> Living technical inventory through v0.5 code commit `5a26dfe1` (Particle VFX + full Core Relay acceptance path).
>
> Package version: `0.5.0`.
>
> Active branch: `forge-v0.5`. The previous `forge-v0.4` branch is retained as historical foundation.

## Product structure

Forge currently has two connected experiences:

1. **Forge Platform** — Home/Games/Favorites/Friends/Develop, accounts, catalog, publishing/social metadata.
2. **Forge Studio + Runtime** — 3D creation, assets, scripts, Play mode and gameplay runtime.

Forge is not yet a finished v1 engine/platform.

## Stack

- TypeScript 5.9
- Vite 7
- Babylon.js 8 + loaders
- Supabase JS 2
- Playwright
- Node 22 in CI
- GitHub Actions
- `forge.scene` JSON documents

## Scene model

Canonical format:

- `format: "forge.scene"`
- `version: 1`

Current entity kinds:

- box
- wedge
- sphere
- capsule
- cylinder
- ground
- empty
- model

Entity data includes stable id/name, position, rotation, scale, true size, color, material, emissive, transparency, texture, components and parentId.

Material presets:

- plastic
- matte
- metal
- glass
- neon

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
- Particle
- UI
- Model
- Spawn

Environment supports skyColor, custom skyTexture, skyTextureFileName, ambientColor, fogColor and fogDensity.

Studio lighting includes Day / Sunset / Night / Foggy presets. Manual lighting edits preserve an imported custom sky; choosing a preset intentionally returns to the generated color sky.

## Studio

Implemented:

- Explorer hierarchy
- Properties
- selection
- Move / Rotate / Resize
- World / Local transform space
- numeric transform/size editing
- separate Move / Rotate / Resize snapping
- primitive Resize bakes into canonical Size
- gizmo drag Undo checkpoints
- focus selection
- duplicate/delete
- undo/redo
- primitive/semantic creation palettes
- hierarchy/parenting
- Groups
- collider visualization toggle in the Studio viewport
- Collider component modes: Mesh or Box Proxy
- editable Box Proxy size and local offset
- Auto-fit Box Proxy from current visual/model bounds
- custom prefab export/import for selected hierarchies (`.forge-prefab.json`)
- Explorer drag/drop reparenting
- cycle prevention
- world-transform preservation while reparenting
- material presets
- transparency/textures/emissive
- Spawn
- Light
- Sound
- Particle VFX
- UI
- Script/LocalScript/ModuleScript
- GLB import with embedded animation clip discovery/playback
- texture import
- audio import
- custom sky image import
- save/load/import/export
- persistent Output

Editor navigation:

- WASD: translate camera
- right mouse drag: orbit/look
- wheel: zoom
- F: focus
- left mouse: select/manipulate

## Rendering

Implemented:

- standard Babylon rendering
- gradient sky fallback
- custom imported sky image
- ambient/fog controls
- light objects
- material presets
- textures
- emissive/transparency
- authorable particle VFX with Energy / Sparks / Smoke presets
- dynamic shadows when supported
- avatar/imported-model shadow/collision integration

Dynamic shadows must degrade gracefully if unsupported.

## Player

Forge Classic currently has:

- six-part block body
- equal rectangular limbs
- block head
- Forge =] face/identity
- third-person camera
- optional first-person toggle
- WASD
- sprint
- jump
- E interaction

Movement now includes:

- acceleration
- deceleration
- air control
- coyote time
- jump buffering
- tuned jump arc
- smoother facing
- tighter release/landing behavior
- sprint blending with subtle FOV response
- landing compression feedback
- distinct rise/fall animation states
- first/third-person zoom preservation
- protected third-person camera distance and vertical orbit limits

Further feel tuning and a stronger animation controller are still expected.

## Scripting

Script kinds:

- Script
- LocalScript
- ModuleScript

Major current creator/runtime capabilities:

- lifecycle hooks
- interaction
- input/events
- UI click events
- object lookup
- transforms
- runtime create
- clone/destroy
- `Forge.module(...)`
- `Forge.require(...)`
- audio control
- UI control
- VFX play/stop/restart control
- model animation play/stop control
- player API
- camera API
- logging/output

Current scripts are trusted creator code, not a hardened hostile-code sandbox.

## UI

UI types:

- text
- button
- panel

UI supports position, size, font size, colors/background, visibility and anchors.

UI click routing into child scripts is regression-tested to fire once.

## Model animation

Imported GLB models can expose embedded animation clips through the Model component.

Current authoring supports:

- clip selection
- autoplay in Play mode
- loop on/off
- playback speed
- editor Preview / Stop
- script control through `Forge.animation.play/stop`
- queued script playback while an async GLB load is still pending
- animation-group lifecycle cleanup across rebuild/delete/Play transitions

This is clip playback, not yet the planned full animation controller/state machine.

## Audio

Sound supports:

- src/fileName
- volume
- loop
- autoplay
- spatial
- maxDistance

## VFX

Particle emitters currently support:

- enabled/autoplay
- Energy / Sparks / Smoke presets
- two author colors
- emit rate
- capacity
- lifetime
- particle size
- speed
- editor preview
- script control through `Forge.vfx.play/stop/restart`

This is the first authorable VFX layer, not a final node/graph-based effects system.

## Imports

Current browser import path:

- GLB, including embedded AnimationGroups
- image texture
- audio/WAV
- sky image

A production asset CDN/library is still future work.

## ForgeAI

Current structured operations:

- create_box
- place_prefab
- set_components
- rename
- move
- rotate
- scale
- delete

Still planned: room/corridor/connect-room semantic building, richer component/material/UI operations and reviewable KEEP/UNDO change sets.

## Acceptance game

`Core Relay` is the current small-game acceptance benchmark.

It uses Spawn, collisions, interactables, ModuleScript, Script, LocalScript, HUD UI, Sound, Light, Particle VFX, environment controls and a completion/win state. It is available as a playable Develop template.

Browser Smoke now performs the actual gameplay route: it calibrates movement, follows collider-safe axis-aligned world-space gates using real WASD input at walking speed, requires the player-visible interaction prompt at Relay A/B/C, presses E, verifies 3/3, requires `CORE_RELAY_WIN` and confirms the victory VFX restart.

The benchmark exists to expose engine deficiencies through real game construction.

## Forge Platform

Guests can:

- browse/play public games
- create local projects
- use Studio
- save locally
- duplicate/rename/delete
- keep local favorites/recents

Forge Cloud adds:

- signup/signin/signout
- cloud profiles
- project ownership/sync
- private/unlisted/public visibility
- public catalog
- favorites
- recents
- creator metadata/profiles
- friend requests
- game details
- public deep links

Public game URL format:

```text
#game/<slug>
```

Friends currently support add-by-username, pending requests, accept, cancel/decline/remove.

Not implemented: live presence, Join Friend, server state and chat.

## Security

Cloud uses Supabase RLS and protected RPCs.

Rules:

- public reads remain narrow
- project writes require auth/ownership
- official projects are protected
- user-specific lists remain owner scoped
- social RPCs require auth

Cloud Smoke verifies anonymous writes fail.

## Verification commands

```bash
npm install
npm run check
npm run build
npm run test:browser
npm run test:cloud
```

GitHub Actions:

- Forge CI
- Forge Browser Smoke
- Forge Cloud Smoke
- Deploy Forge Preview

## Deployment

Automated preview branch:

```text
forge-preview-v05
```

This branch name is historical and is generated by CI; do not edit it manually.

## Not complete yet

Do not describe these as finished:

- multiplayer/server authority
- replication
- server browser
- presence/Join Friend
- chat
- production asset CDN/library
- full animation asset/controller pipeline
- advanced VFX authoring (custom textures, emitter shapes, bursts/curves and effect graphs)
- terrain editor
- mature physics/collision editor
- moderation
- hostile-code sandbox
- full AI room/corridor builder
- finished Project Helios gameplay loop
- final publishing/version/server lifecycle
- mature profiler/performance tooling

## Near-term quality bar

The goal is no longer "add buttons."

A creator should be able to make a game that looks intentional, feels natural, uses assets/scripts/audio/UI, playtests instantly, saves/publishes and can be played by someone else.


## Collider authoring

The Collider component supports two modes:

- **Mesh** — the visible primitive/model meshes participate directly in Babylon collisions.
- **Box Proxy** — Forge creates a separate invisible box collider parented to the entity root.

Box Proxy exposes local size and offset controls in the Inspector plus **Auto-fit to Visual**, which computes a local bounding box from the entity's rendered primitive/GLB geometry. The proxy stays invisible in Play mode and is rendered only by the Studio **Colliders On** visualization. Proxy settings serialize with the scene/prefab and are recreated across reload, rebuild, Play/Stop and prefab import.
