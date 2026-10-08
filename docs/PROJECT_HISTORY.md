# Forge =] Project History

> Historical record reconstructed from the Git history of `NeuroVendas/-game-engine`.
>
> Snapshot covered by this document: through commit `15f41800` on branch `forge-v0.4`.
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

The historical creator/platform foundation remains on `forge-v0.4`.

Creator-quality development was formally split to:

- active branch: `forge-v0.5`
- package version: `0.5.0`
- draft PR: #12 — Forge v0.5: Creator Experience

Do not infer capability only from old branch names.

## 15. Source-of-truth priority

After context loss, trust in this order:

1. current code/schema
2. automated tests
3. `docs/CURRENT_STATE.md`
4. this history
5. architecture/decision/product docs
6. old chat descriptions

The repository is canonical.


## 16. Forge v0.5 — Creator Experience formalized

After the documentation/recovery milestone, active work moved from the historically named `forge-v0.4` branch to `forge-v0.5`.

The v0.5 quality target is explicit: a new creator should be able to build a small game without the Studio or runtime immediately feeling like a prototype.

### Transform workflow

The first v0.5 Creator Experience pass added:

- explicit World / Local transform space
- Ctrl+5 space toggle
- separate Move / Rotate / Resize snap controls
- gizmo drag Undo checkpoints
- primitive Resize that bakes visual scaling into canonical object `size`
- model/group scale remains transform-based instead of being incorrectly baked as primitive size

### Core Relay acceptance game

A complete small benchmark game named **Core Relay** was added to `public/scenes/core-relay.forge.json` and exposed under Develop -> Starter Templates.

It intentionally exercises Forge systems together:

- player spawn/collision
- three interactable relay consoles
- ModuleScript shared state
- gameplay Scripts
- LocalScript UI interaction
- HUD panel/text/button
- real WAV sound asset
- light/environment
- completion event
- exit unlock
- visible win state

Core Relay is not decorative sample content. It is an engine acceptance test: if building or running it exposes a missing capability, that gap becomes engine work rather than an external workaround.

### v0.5 tracking

- #9 — Creator Experience umbrella
- #10 — Professional transform workflow
- #11 — complete mini-game acceptance test
- PR #12 — Forge v0.5: Creator Experience


## 17. Forge v0.5 — Particle VFX and real Core Relay completion coverage

The first authorable VFX layer was added as a canonical `Particle` component rather than a separate editor-only effect path.

### Particle VFX

Studio creators can insert **Particle VFX** objects or add the Particle component to an existing entity.

Current authoring supports:

- Energy / Sparks / Smoke presets
- enabled/autoplay
- two colors
- emit rate
- capacity
- lifetime
- size
- speed
- live editor preview

Runtime scripts gained:

- `Forge.vfx.play(idOrName)`
- `Forge.vfx.stop(idOrName)`
- `Forge.vfx.restart(idOrName)`

The implementation owns Babylon particle lifecycles alongside lights/sounds/meshes so load, rebuild, delete and Play transitions dispose/recreate effects predictably.

### Core Relay victory VFX

Core Relay now contains `CoreVictoryVFX`, authored in the same `forge.scene` document. It is non-autoplay in Play mode and the game controller restarts it only when all three relays are online.

### Full gameplay acceptance test

Issue #11's largest verification gap was removed: Browser Smoke no longer stops after checking that Core Relay boots.

The test now:

1. enters the Core Relay Develop template,
2. starts Play,
3. calibrates the current player movement axes,
4. traverses open floor using WASD/sprint,
5. waits for the real interaction prompt for Relay A, B and C,
6. presses E on each,
7. verifies 1/3 -> 2/3 -> 3/3,
8. requires `CORE ONLINE • YOU WIN`,
9. requires `CORE_RELAY_WIN`,
10. requires the victory VFX restart action,
11. stops/starts Play again to regression-check resource lifecycle.

The first coordinate-microstep version timed out in headless Chromium. A first prompt-driven route then passed once but flaked on a repeat because a fast player can cross the prompt window between polling frames.

A second closed-loop waypoint attempt exposed another useful constraint: waypoints must respect the player's collision radius and the solid relay geometry, not only the relay center coordinates.

The final route uses collider-safe, axis-aligned coordinate gates at normal walking speed. It approaches each console from open floor, stops before the collider face, and then requires the same interaction prompt a player sees before pressing E. This preserves real gameplay coverage while removing both frame-timing dependence and impossible/ambiguous target positions.

Verification for code commit `5a26dfe1`:

- Forge CI: success
- Forge Cloud Smoke: success
- Forge Browser Smoke: success (7/7)


## 18. Forge v0.5 — Player feel and Studio environment pass

A follow-up creator-quality branch `feature/v05-player-feel` was stacked on top of the Particle VFX/Core Relay acceptance work.

### Player feel

The Forge Classic controller now adds:

- smoother walk/sprint speed transition
- subtler classic walk animation
- distinct jump-rise and jump-fall poses
- landing compression feedback
- sprint FOV response
- third-person vertical orbit limits
- a protected minimum third-person zoom distance so the camera does not collapse into the avatar
- first/third-person switching that preserves the creator/player's previous third-person zoom instead of resetting to a fixed radius

Browser regression coverage now checks sprint speed and first/third-person camera restoration in addition to the existing acceleration/jump assertions.

### Studio environment workflow

Lighting now exposes one-click presets:

- Day
- Sunset
- Night
- Foggy

The preset path writes the same canonical `environment` scene data as manual editing.

A bug was also fixed where manually changing environment values after importing a sky image could discard the imported sky fields. Manual edits now preserve custom sky metadata; choosing a preset intentionally clears the custom sky and returns to the generated color sky.

Browser coverage verifies both behaviors.

### Verification note

Forge CI passes for this branch. Forge Cloud Smoke initially failed because the external Forge Supabase project had become inactive, not because of the code changes; the project was restored before final branch verification.


## 19. Forge v0.5 — Collider visibility and custom prefabs

The next creator-quality slice focuses on authoring confidence and reuse.

### Collider visibility

Studio gained a **Colliders On / Off** viewport toggle.

- collider-enabled objects render a dedicated edge overlay in Editor mode
- imported model child meshes participate in the same visualization
- the overlay is disabled during Play
- returning to Editor restores the creator's previous collider-debug state
- diagnostics expose the active state and visible collider count for regression tests

This avoids using object-selection bounding boxes as a substitute for physics visualization.

### Custom prefab workflow

Forge now has a canonical reusable prefab document:

- `format: "forge.prefab"`
- `version: 1`
- selected object/group plus descendants
- export to `.forge-prefab.json`
- import into the current scene
- hierarchy is preserved
- entity IDs are remapped on every import to avoid collisions
- custom script names that track generated entity IDs are remapped with the new IDs
- prefab root position is normalized to the local origin
- importing while an object is selected parents the prefab root under that object

This is intentionally the first reusable-prefab layer, not yet a full asset-library/package system.


## 20. Forge v0.5 — GLB animation clips

Forge's model import path now treats embedded GLB animation clips as a first-class creator/runtime capability instead of ignoring loader AnimationGroups.

### Model authoring

The Model component can configure:

- animation clip
- autoplay in Play
- loop
- playback speed

When an imported model finishes loading, Studio refreshes the selected Model inspector with the discovered clip names. Creators can Preview and Stop the clip directly in Editor mode.

### Runtime ownership

Forge now owns imported AnimationGroups per model entity.

- Babylon's implicit imported-animation playback is stopped after load
- configured autoplay starts only in Play mode
- rebuild/delete/document transitions stop and dispose owned groups
- async model loads dispose their groups if their Forge root disappeared before completion
- runtime diagnostics expose loaded animation-group counts and clip names

### Script API

Creator scripts can call:

- `Forge.animation.play(idOrName, clipName?)`
- `Forge.animation.stop(idOrName, clipName?)`

The same Model loop/speed settings are used by runtime playback. Calls made from `onStart` before the async GLB loader has finished are queued per model and replayed as soon as its AnimationGroups become available; `stop` cancels a pending request.

### Acceptance coverage

Browser Smoke generates a real animated GLB fixture with a `Bounce` translation clip and validates clip discovery, Inspector selection, Preview, Stop, autoplay in Play, and clean return to Editor.


## 21. Forge v0.5 — Box proxy colliders

Collider authoring now supports a dedicated collision volume instead of forcing every object or imported model to collide against its visible mesh.

### Collider modes

The Collider component supports:

- `mesh` — use the visible primitive/model geometry
- `box` — use an invisible local box proxy

Box Proxy exposes:

- Size X / Y / Z
- Offset X / Y / Z
- **Fit Proxy To Visual**, which computes the local bounds of the current visible primitive or imported GLB geometry

The proxy inherits the Forge entity transform, remains non-pickable, and becomes the collision source while visible model meshes stop colliding.

### Studio visualization

The existing Colliders toggle now displays the actual box proxy volume when Box Proxy mode is active. The proxy is hidden in normal Editor view and during Play.

### Persistence

Proxy mode, size and offset are canonical scene data and survive custom prefab export/import. Browser acceptance coverage validates authoring, diagnostics, prefab round-trip and Editor -> Play -> Editor state.
