# Forge =] Architecture

## Architectural goal

Forge must remain easy to edit through the visual editor, ordinary source code, and AI tools.

The canonical project representation must therefore remain structured, versionable, and human-readable.

## Current stack

Forge v0.3 uses TypeScript, Vite, Babylon.js, JSON scene documents, Git/GitHub, and GitHub Actions.

Planned platform infrastructure may later include services for accounts, profiles, friends, game metadata, multiplayer sessions, publishing, and persistent storage.

Infrastructure choices must not leak unnecessary complexity into the creator experience.

## Current repository structure

src contains ai, editor, engine, player, and shared types.

public/scenes contains editable Forge scene documents.

scripts contains validation tooling.

docs contains product, architecture, AI, roadmap, and game direction.

## Scene documents

Scene files use the forge.scene format.

Goals:

- stable entity IDs
- semantic names
- simple transforms
- explicit components
- versioned schema
- deterministic serialization
- easy diffs in Git

## Entity/component direction

Forge entities should become lightweight containers of data.

Behavior should come from components and scripts.

Target concepts include Transform, Mesh, Collider, Interactable, Door, PowerConsumer, Clearance, and Script.

The component system should remain inspectable in the editor.

## Scripting direction

The scripting API should favor readable gameplay code.

Target usage should feel like getting an object by semantic name, listening for an interaction, checking player state, and calling a high-level action such as open.

The SDK should provide high-level concepts for common gameplay without forcing creators into engine internals.

## AI architecture

AI operations must operate on structured engine concepts.

Current primitive operations include create_box, move, rotate, scale, and delete.

Planned semantic operations include create_room, create_corridor, place_prefab, connect_rooms, add_component, attach_script, set_material, set_lighting, and create_ui.

AI changes should eventually produce a reviewable change set with KEEP and UNDO.

## Runtime/editor boundary

Editor state and Play state must remain separate.

When Play begins, snapshot editable scene state, instantiate runtime systems, enable player and gameplay, and allow runtime scripts to modify the running world.

When Play ends, destroy runtime-only state and restore editor scene state.

Runtime changes should not silently mutate source data.

## Validation pipeline

Expected loop:

EDIT -> VALIDATE SCENES -> TYPECHECK -> BUILD -> PREVIEW / PLAYTEST -> REVIEW -> MERGE

CI must catch invalid scene format, duplicate entity IDs, broken TypeScript, and production build failures.

Future validation should include broken references, missing scripts, invalid component combinations, prefab integrity, asset references, and save/load round trips.

## Performance direction

Prefer scalable systems early when they are cheap: instancing for repeated geometry, asset reuse, component data separation, predictable scene serialization, lazy loading for large projects, and clear client/server boundaries before multiplayer.

Do not prematurely optimize systems that do not yet constrain real games.
