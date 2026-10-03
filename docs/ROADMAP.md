# Forge =] Roadmap

This roadmap is directional. Version numbers communicate product milestones, not calendar promises.

## v0.3 — Real engine foundation

Goal: replace the single-file prototype with a maintainable engine/editor project.

Current scope:

- TypeScript + Vite
- Babylon.js runtime
- Explorer
- Properties
- 3D viewport
- selection
- move / rotate / scale gizmos
- add / delete entities
- scene JSON format
- Play / Stop
- third-person player
- first/third-person camera toggle
- run + jump
- interactions
- script runtime
- Project Helios sample scene
- Forge AI structured operations
- CI validation and build

Exit criteria: clean production build, editor opens reliably, basic editing is usable, Play mode is controllable, scene export works, and Project Helios is sufficient to test movement and interaction.

## v0.4 — Creation systems

Goal: make Forge useful for actual game logic.

Planned: real component inspector, add/remove components visually, script editor, script attachment UI, prefabs, prefab instances, asset IDs, undo/redo, copy/paste, folders/groups, snapping, better transforms, reliable save/load.

Project Helios proof: powered blast doors, clearance doors, interactive consoles, reactor state, alarms, equipment components.

## v0.5 — Creator workflow

Goal: make building larger games comfortable.

Planned: asset browser, primitive palette, materials browser, UI editor, spawn objects, lights, decals, sound objects, simple terrain, templates, project browser, autosave, scene hierarchy improvements.

Project Helios proof: control-room UI, alarms, industrial soundscape, reusable reactor prefabs, surface facility and secret sublevel.

## v0.6 — World quality

Goal: improve feel without sacrificing simplicity.

Planned: better physics, audio mixer, animation support, particles, imported glTF assets, modern rendering options, performance tools, better collision editing.

Project Helios proof: machinery motion, emergency lighting, steam/particles, environmental alarms, reactor visual states.

## v0.7 — Multiplayer

Goal: multiple people playing the same Forge game.

Planned: networking model, player replication, server authority rules, remote events/RPC equivalent, player list, chat, server browser basics, join server, local test server workflow.

Project Helios proof: reactor crew, synchronized doors, synchronized reactor state, shared incidents, multiple roles.

## v0.8 — Accounts and social

Goal: begin Forge as a platform, not only an engine.

Planned: accounts, profiles, friends, friend requests, online presence, join friend, creator identity, game ownership, cloud saves.

## v0.9 — Publishing

Goal: creators can publish Forge games.

Planned: publish flow, game pages, thumbnails, descriptions, versions, visibility settings, server launch, favorites, basic discovery, moderation foundations.

## v1.0 — Forge Platform

Goal: complete the first coherent creator-to-player loop.

CREATE -> SCRIPT -> PLAYTEST -> PUBLISH -> FRIENDS JOIN -> ITERATE

## Explicitly not early priorities

Do not prioritize virtual currency, marketplace economy, paid discovery, creator payouts, cosmetic economy, complex UGC commerce, or enterprise collaboration systems before the core creation/play/social loop works.
