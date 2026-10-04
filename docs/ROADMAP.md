# Forge =] Roadmap

Versions are capability milestones, not calendar promises.

## v0.3 — completed foundation

Delivered modular TypeScript/Vite/Babylon engine, scene JSON, Studio foundation, player, scripting, Helios, ForgeAI and CI.

## v0.4 — substantially completed creator/platform foundation

Delivered far beyond the original scope:

- Undo/Redo
- creation/snapping
- save/load/import/export
- editable components
- prefabs
- custom scripting
- Playwright runtime tests
- Forge Classic avatar
- classic platform launcher
- local project persistence/direct Play
- Forge Cloud
- accounts/profiles/projects
- publishing visibility/catalog
- favorites/recents
- Friends
- creator/game details
- shareable game URLs

The historical implementation branch is `forge-v0.4`. Active creator-quality work now continues on `forge-v0.5`.

## Current v0.5 — Creator Experience / credible engine quality

Already delivered:

- expanded object/component model
- true Resize/size editing
- hierarchy/Groups/drag-drop
- Spawn/Light/Sound/UI/Particle VFX
- Energy/Sparks/Smoke particle presets + script play/stop/restart
- GLB/texture/audio/sky import
- material presets/transparency
- shadows with fallback
- Output console
- Script/LocalScript/ModuleScript
- modules/player/camera/audio/UI/world APIs
- runtime create/clone/destroy
- improved movement/jump feel
- Core Relay full browser-playthrough acceptance: Relay A/B/C -> WIN -> victory VFX

### Creator Experience acceptance

v0.5 should feel like a usable creator tool, not a prototype editor.

- Move/Rotate/Resize must be predictable and undoable
- World/Local transform space must be explicit
- primitive Resize changes real object dimensions rather than silently accumulating scale
- per-tool transform snapping must be creator-configurable
- player/camera feel must remain a tested product surface
- assets, UI, audio and scripts must be sufficient to build a complete small game
- browser smoke must cover creator workflows, not only compilation

### Remaining focus

- movement/camera feel
- stronger animation system
- practical asset workflow
- better UI authoring
- audio mixer/workflow
- advanced VFX workflow: custom particle textures, emitter shapes, bursts/curves and richer composition
- richer lighting without losing simplicity
- physics/collision authoring
- prefab/model workflow
- script autocomplete/editor ergonomics
- semantic AI room/corridor builder
- serious Helios vertical slice

Exit criterion: an unfamiliar creator can build a small game that does not immediately look or feel like an engine prototype.

## v0.6 — world/game quality

Target animation controller, advanced particles/effects composition, improved physics tools, collision visualization, audio buses, asset management, decals/environment tools and performance/debugging.

## v0.7 — multiplayer

Target server authority, player/entity replication, remote events/RPC, multi-client test workflow and server lifecycle.

## v0.8 — social presence

Accounts/Friends shipped early. Focus becomes real-time presence, Join Friend, invitations and server association.

## v0.9 — production publishing/discovery

Basic publishing exists. Future work includes versioned releases, hosted assets, thumbnails/media, production servers, discovery and moderation foundations.

## v1.0 — coherent creator-to-player loop

```text
CREATE -> SCRIPT -> PLAYTEST -> PUBLISH -> FRIENDS/SERVERS -> ITERATE
```

v1.0 means coherent and reliable, not merely feature-present.

## Deferred

Virtual currency, marketplace economy, paid discovery, payouts and enterprise collaboration remain deferred until core creation/gameplay/social loops are strong.
