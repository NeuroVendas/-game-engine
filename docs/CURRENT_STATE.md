# Forge =] Current State

> Living technical inventory for the current v0.5 Creator Experience milestone on `forge-v0.4`.
>
> Package version: `0.5.0`.
>
> Historical branch name: `forge-v0.4`.

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
- VFX
- UI
- Model
- Spawn

Environment supports skyColor, custom skyTexture, skyTextureFileName, ambientColor, fogColor and fogDensity.

## Studio

Implemented:

- Explorer hierarchy
- Properties
- selection
- Move / Rotate / Resize
- numeric transform/size editing
- snapping
- focus selection
- duplicate/delete
- undo/redo
- primitive/semantic creation palettes
- hierarchy/parenting
- Groups
- Explorer drag/drop reparenting
- cycle prevention
- world-transform preservation while reparenting
- material presets
- transparency/textures/emissive
- Spawn
- Light
- Sound
- VFX emitter presets (sparks/smoke/fire/glow/dust)
- UI
- Script/LocalScript/ModuleScript
- GLB import
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

Further feel tuning is expected.

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
- player API
- camera API
- logging/output

Current scripts are trusted creator code, not a hardened hostile-code sandbox.

## VFX

Forge now has a first particle/VFX authoring pass:

- VFX Emitter object/component
- presets: sparks, smoke, fire, glow and dust
- editor preview
- emit rate/lifetime/size/speed/colors/gravity controls
- runtime autoplay
- script API: `Forge.vfx.play`, `Forge.vfx.stop`, `Forge.vfx.setRate`

This is the initial VFX layer. Trails, beams, decals, post-processing stacks and a richer particle graph remain future work.

## UI

UI types:

- text
- button
- panel

UI supports position, size, font size, colors/background, visibility and anchors.

UI click routing into child scripts is regression-tested to fire once.

## Audio

Sound supports:

- src/fileName
- volume
- loop
- autoplay
- spatial
- maxDistance

## Imports

Current browser import path:

- GLB
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
forge-preview-v04-controls
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
- advanced VFX authoring (trails/beams/decals/post FX; basic particles now exist)
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
