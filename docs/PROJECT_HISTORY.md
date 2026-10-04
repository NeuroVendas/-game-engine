# Forge =] Project History

> Historical record reconstructed from the Git history of `NeuroVendas/-game-engine`.
>
> Snapshot covered by this document: through the v0.5 Creator Experience / first VFX milestone on branch `forge-v0.4`.
>
> This file exists so the project can be recovered even if chat context, local notes, or contributor memory are lost.

## 1. Origin

Forge began as a new repository on 2026-10-03 with commit `4fc5119f` (`chore: initialize Forge engine repository`).

The original product direction was established immediately:

- Forge =] is an AI-first 3D game engine and social game platform.
- It should preserve the approachable, blocky, creative feel of classic online sandbox platforms without cloning another product.
- Visual editing, code, and AI must edit the same canonical project representation.
- Project Helios is the benchmark game used to pressure-test real engine requirements.
- The creator loop matters more than monetization: create -> script -> playtest -> publish -> play with others -> iterate.

## 2. v0.3 — first modular engine

The first real engine foundation landed in a concentrated series of commits beginning at `2bce9e69`.

### Technical foundation

v0.3 introduced TypeScript, Vite, Babylon.js, scene JSON using `forge.scene` v1, modular engine/editor/player/AI code, GitHub Actions validation/build, and Project Helios as an editable sample scene.

Core files introduced in this period included:

- `src/types.ts`
- `src/engine/ForgeEngine.ts`
- `src/engine/ScriptRuntime.ts`
- `src/engine/defaultScripts.ts`
- `src/player/PlayerController.ts`
- `src/editor/EditorApp.ts`
- `src/ai/ForgeAI.ts`

### Initial Studio

The first Studio supported a 3D viewport, Explorer, Properties, selection, move/rotate/scale gizmos, add/delete, Play/Stop and scene export.

### Initial runtime

The first player controller included WASD, sprint, jump, third-person camera, first/third-person toggle and E interaction.

### Initial AI contract

Commits `43a07a87` and `087450a3` established structured AI authoring.

Initial operations:

- `create_box`
- `move`
- `rotate`
- `scale`
- `delete`

Core rule: AI edits structured engine data instead of faking mouse input.

### Initial validation

v0.3 added scene validation, TypeScript checking, production builds and CI. This is the point where Forge stopped being a disposable prototype and became a versioned engine project.

## 3. Documentation/governance foundation

Before expanding v0.4, the repository gained:

- `docs/VISION.md`
- `docs/PRODUCT_PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `docs/STYLE_GUIDE.md`
- `docs/PROJECT_HELIOS.md`
- `docs/DECISIONS.md`
- `CONTRIBUTING.md`
- `AGENTS.md`
- PR/issue templates

This established Forge's identity and prevented future work from drifting into a generic Babylon demo.

## 4. v0.4 — editor usability and creator workflow

### History and creation

Added Undo/Redo, Duplicate, classic creation palette, Block/Wedge/Cylinder/Sphere/Capsule/Ground, snapping and history counters.

### Navigation

Early camera/manipulation experiments were iterated aggressively.

The final direction became:

- WASD translates the editor camera
- right-drag rotates/orbits
- wheel zooms
- left mouse selects/manipulates
- F focuses selection

A custom six-axis manipulation experiment was removed after proving worse than conventional editor controls.

### Save/load/import

Added local save, local load, scene import/export and validation of loaded documents.

### Components

The component inspector became creator-editable. Early components included Collider, Interactable, Door, Clearance, PowerConsumer, Reactor and Script.

### Semantic prefabs

Initial industrial prefab library:

- blast door
- console
- catwalk
- coolant pump

ForgeAI learned semantic prefab/component operations.

### Project Helios proof

Helios gained classified access, Level 4 clearance, AUX GRID clues, interaction HUD and locked/clearance prompts.

## 5. Play-mode failure and testing turning point

The first public static preview exposed a major problem: HTML/CSS could render while the actual 3D app failed, causing a black viewport, empty Explorer and non-functional controls.

Deployment work then:

- replaced broad Babylon imports with granular imports
- bundled Project Helios instead of runtime-fetching it
- reduced the main JS bundle from roughly 6.1 MB to roughly 1.28 MB at that milestone
- moved preview output to a dedicated `forge-preview-v04-controls` branch

Commit `59902d53` introduced Playwright Browser Smoke.

From this point, "it compiles" stopped being accepted as proof that gameplay/editor behavior works.

### Collision runtime bug

Play mode still failed after compilation succeeded. The root cause was missing Babylon collision coordinator registration after import optimization.

Commit `0b2832b1` restored it.

This incident is why runtime behavior now requires real browser coverage.

## 6. Custom scripting

Commit `e95a7d0f` added creator-facing custom JavaScript saved in scene data.

Initial APIs included:

- `Forge.onStart`
- `Forge.onUpdate`
- `Forge.onInteract`
- `Forge.onDestroy`
- `Forge.self`
- `Forge.world.get(...)`
- `Forge.log(...)`

Script errors were isolated so creator mistakes did not automatically kill the whole game loop.

Browser tests began authoring, saving and executing real creator code.

## 7. Forge Classic avatar

The placeholder avatar was replaced with Forge Classic:

- six-part blocky rig
- rectangular torso
- equal rectangular limbs
- block head
- original Forge =] identity
- rigid whole-limb classic animation

Animation was rebuilt around shoulder/hip pivots instead of rotating limbs around their centers.

## 8. Forge Platform shell

Forge expanded from Studio into a player/creator platform.

Launcher areas:

- Home
- Games
- Favorites
- Friends
- Develop

Added:

- local profile
- recent plays
- project stats
- templates
- project search
- direct Play without opening Studio first
- create/edit/duplicate/rename/delete
- local persistence
- autosave when leaving Studio

Platform and Studio are intentionally separate experiences.

## 9. Forge Cloud

A dedicated Supabase project named Forge was created in `sa-east-1`.

Cloud features added:

- accounts/auth
- profiles
- cloud projects
- private/unlisted/public visibility
- favorites
- recents
- friendships
- publishing metadata
- official Project Helios public catalog entry

### Security

Forge Cloud uses RLS.

The intended model:

- public reads are limited to public/catalog/profile data
- anonymous project writes are blocked
- authenticated creators mutate only their own normal projects
- official projects are protected
- user lists/social data remain user scoped
- friend RPCs require authentication

The Supabase security advisor reached zero security lints at the documented milestone.

### Cloud Smoke

A live cloud test verifies Supabase reachability, public Helios presence, anonymous write blocking and protected social RPC behavior.

## 10. Social/public game pages

Forge gained:

- friend requests by username
- incoming/outgoing/accepted states
- accept/remove behavior
- creator metadata
- creator profiles
- public creator games
- game details
- descriptions
- visibility controls
- Play/Edit/Remix
- public game URLs using `#game/<slug>`

Signing out removes cached private cloud projects from guest-visible state.

## 11. v0.5-dev — Studio becomes a credible engine

Package version advanced to `0.5.0` while development continued on the historical `forge-v0.4` branch.

### Expanded object model

Entities now support box, wedge, sphere, capsule, cylinder, ground, empty and imported model objects.

Authoring fields now include transform, true size, color, emissive, transparency, texture, material and parent hierarchy.

Material presets:

- plastic
- matte
- metal
- glass
- neon

### New component/object families

Added Light, Sound, UI, Model and Spawn.

### Assets

Studio can import GLB models, image textures, audio and custom sky images.

### Environment/rendering

Added sky color, custom sky image, ambient/fog controls, gradient fallback, image-processing improvements and dynamic shadows.

Dynamic shadows are optional/capability-sensitive. If unavailable, Studio must continue instead of crashing.

### Hierarchy

Added parent selection, cycle prevention, Group, Explorer drag/drop parenting, Workspace unparenting and world-transform preservation during reparent.

### Spawn

Spawn Location became a first-class object/component.

### Player feel

Movement evolved to include acceleration, deceleration, air control, coyote time, jump buffering, tuned jump arc, smoother facing and tighter stop/landing behavior.

Browser tests measure velocity response rather than only position change.

### Typed scripting

Current script kinds:

- Script
- LocalScript
- ModuleScript

ModuleScripts export with `Forge.module(...)` and are consumed through `Forge.require(...)`.

Runtime APIs expanded to include input/events, audio, UI, world lookup, runtime create/clone/destroy, player and camera helpers.

Startup order was fixed so player/camera-dependent scripts start after those runtime systems exist.

### Script debugging

Added persistent Output, syntax checks, error isolation and browser regression coverage.

### UI

Current UI object types:

- text
- button
- panel

UI events dispatch into scripts. A regression was fixed so parent/child event routing fires exactly once.

### Audio

Sound objects support runtime/creator metadata and real audio import is tested with generated WAV data.

### Materials/live editing

Properties gained material presets, transparency and textures.

Live rebuild fixes preserve hierarchy, gizmo attachment and collision behavior.

## 12. Verification culture

Forge currently has four automated lanes.

### Forge CI

- scene validation
- TypeScript check
- production build

### Forge Browser Smoke

Real Chromium covers major platform/editor/runtime flows including player motion, jump response, project CRUD/persistence, scripting, resize/tool state, environment/sky, textures, hierarchy, UI, typed scripts, ModuleScript, GLB and audio import.

### Forge Cloud Smoke

Hits the real backend and checks integration/security expectations.

### Deploy Preview

Builds and force-publishes `dist` to the dedicated preview branch.

## 13. Mistakes that must not be repeated

### "Compiles" is not "works"

The collision coordinator incident proved real browser runtime checks are mandatory.

### Do not hide limitations with worse custom UX

The custom six-axis manipulation experiment was rejected. Conventional, understandable 3D controls win unless novelty is demonstrably better.

### Rendering quality must degrade gracefully

Dynamic shadow startup fragility proved optional renderer features cannot be allowed to prevent Studio boot.

### Static hosting must be portable

Absolute-path assumptions broke preview hosting. Assets/build paths must work in the actual deployment environment.

### Do not fake social data

Before cloud existed, unavailable social features were shown honestly instead of simulating fake online state.

### Build against a real game

Project Helios exists to stop Forge from becoming a collection of unrelated engine features.

## 14. Version/branch note

Current repository history has a naming mismatch:

- active branch: `forge-v0.4`
- package version: `0.5.0`

The branch name is historical. Do not infer capability from it.

## 15. Source-of-truth priority

After context loss, trust in this order:

1. current code/schema
2. automated tests
3. `docs/CURRENT_STATE.md`
4. this history
5. architecture/decision/product docs
6. old chat descriptions

The repository is canonical.


## 16. First-class VFX

The v0.5 Creator Experience added Forge's first creator-facing visual-effects system.

Delivered in this milestone:

- VFX Emitter as an ordinary Forge entity/component
- presets for sparks, smoke, fire, glow and dust
- live editor preview
- emit rate, lifetime, particle size, speed, dual colors and gravity authoring
- runtime autoplay
- lifecycle-safe cleanup during scene reload, rebuild and deletion
- script controls through `Forge.vfx.play(...)`, `Forge.vfx.stop(...)` and `Forge.vfx.setRate(...)`
- browser regression coverage that authors a VFX object and controls it from creator script code

The system deliberately starts simple. Advanced trails, beams, decals, screen-space/post-processing effects and a node/graph particle editor remain later milestones.

## 17. Documentation/recovery milestone

The repository now carries its own recovery memory instead of depending on chat history.

Canonical recovery documents:

- `docs/PROJECT_HISTORY.md`
- `docs/CURRENT_STATE.md`
- `docs/RECOVERY.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `AGENTS.md`

Future agents should reconstruct project state from code + tests + these documents before relying on old conversational summaries.
