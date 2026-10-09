# CONTINUE HERE — Forge =] current development handoff

> **Last refreshed:** 2026-10-08
>
> **Repository:** `NeuroVendas/-game-engine`
>
> **Canonical continuation branch:** `feature/v05-stabilization`
>
> **Handoff base commit:** `53ed8a9edcfe59e1078965f6ed818991ac0ba0c9`
>
> **Current top PR:** #26 — Stabilization (on top of #25)

## Stop and read this first

If you are ChatGPT Work, Codex, another coding agent, or a developer continuing the current Forge work:

1. Continue from **`feature/v05-stabilization`**.
2. Do **not** restart from `main`, `forge-v0.5`, or earlier feature branches if the goal is to continue the latest work.
3. Before adding another feature, make the current top branch pass the complete verification suite.
4. Read `AGENTS.md`, `docs/CURRENT_STATE.md`, `docs/PROJECT_HISTORY.md`, and this file.
5. Preserve the stacked branch/PR history below. Do not flatten or reimplement already-completed systems unless fixing a regression.

## What we are building

Forge =] is an AI-first 3D game engine + creator Studio + runtime + social game platform built with TypeScript, Vite, Babylon.js, Supabase, Playwright, and GitHub Actions.

The current v0.5 effort is focused on making Studio capable of building real, intentional games rather than just exposing buttons.

Core principle:

```text
CREATE -> SCRIPT -> PLAYTEST -> BUILD REAL GAME -> MULTIPLAYER -> SOCIAL -> PUBLISH
```

Project Helios is the long-term benchmark. Core Relay is the current small-game acceptance benchmark.

## Current stacked development line

The latest line is intentionally stacked. The current continuation point is the final branch below.

| PR | Branch | Base | What it adds |
|---|---|---|---|
| #13 | `feature/v05-vfx-core-relay` | `forge-v0.5` | Particle VFX + Core Relay acceptance |
| #14 | `feature/v05-player-feel` | #13 branch | Player feel + environment workflow |
| #15 | `feature/v05-collision-prefabs` | #14 branch | Collider debug + custom prefabs |
| #16 | `feature/v05-model-animations` | #15 branch | GLB animation workflow |
| #17 | `feature/v05-collider-proxies` | #16 branch | Mesh/Box Proxy collider authoring + auto-fit |
| #18 | `feature/v05-project-prefab-library` | #17 branch | Project-scoped reusable Prefab Library |
| #20 | `feature/v05-trigger-volumes` | #18 branch | Trigger volumes + player physics + checkpoint/respawn |
| #21 | `feature/v05-player-health` | #20 branch | Player health/death/manual+auto respawn |
| #22 | `feature/v05-hazard-volumes` | #21 branch | Hazard / repeated damage zones |
| #23 | `feature/v05-player-kill-plane` | #22 branch | Player Kill Y / fall death |
| #24 | `feature/v05-studio-clipboard` | #23 branch | Hierarchy-aware copy/paste/duplicate |
| #25 | `feature/v05-studio-quick-actions` | #24 branch | Toolbar quick actions + F2 rename |
| **#26** | **`feature/v05-stabilization`** | #25 branch | **Component/collider lifecycle + low-FPS fixes — CURRENT TIP** |

### Parallel PR warning

PR **#19** (`feature/v05-collider-proxy`) is a parallel/overlapping implementation of collider proxy + player physics work.

Useful complementary parts from that effort were already adopted into the current stacked line (player physics authoring and Reset Proxy).

**Do not merge #19 blindly into the current stack.** It overlaps #17/#20 and can reintroduce duplicate/conflicting collider code.

## Features present at the current tip

The current stack includes, among other existing Forge systems:

- improved Forge Classic movement / jump feel
- first/third-person gameplay camera
- scene-authorable player capsule, walk/run/jump
- player Max Health, damage/heal, death, manual/auto respawn
- checkpoints through `Forge.player.setCheckpoint()`
- scene Kill Y / fall death
- Trigger volumes with `Forge.onTriggerEnter/onTriggerExit`
- Hazard damage zones with configurable damage + interval
- collider debug visualization
- Mesh vs Box Proxy collider mode
- Box Proxy size/offset authoring
- Fit Proxy To Visual for primitive/GLB geometry
- Reset Proxy
- custom prefab export/import
- project-scoped Prefab Library
- GLB embedded animation clip discovery/playback
- model animation Preview/Stop + script playback
- Sound, UI, scripts, modules, VFX, lights, environment controls
- hierarchy-aware copy/paste/duplicate with fresh IDs
- toolbar Copy/Paste/Duplicate/Rename
- F2 rename flow
- Core Relay playable benchmark
- Supabase-backed platform/cloud features already described in `docs/CURRENT_STATE.md`


## October 8 stabilization progress (PR #26)

- On `feature/v05-stabilization`, PR #26 already fixes several failure paths described below: component creation rebuild (Trigger/Hazard), collider edits without reloading imported GLB models, deferred Fit Proxy while loading, low-FPS catch-up, and test calibration changes.
- Registered the Babylon.js `shadowGeneratorSceneComponent` side-effect module; previous Browser Smoke logs showed shadows were unavailable due to this missing registration.
- Extended Forge CI, Browser Smoke, and Cloud Smoke `pull_request` branch filters to include stacked `feature/**` and `fix/**` PRs, so the v0.5 review stack can be validated before landing.
- **Verification is still required**: do not mark #26 or the release green until the new Browser Smoke, CI and Cloud Smoke results are reviewed. The six failures listed below are from the older #25 handoff and must be rechecked, not treated as current failures without evidence.
- **Release gate:** when all checks pass, integrate the stack through a reviewed release PR to `main`, update the automated preview branch from the release source, and smoke-test the deployed preview.

## Immediate task: stabilize Browser Smoke before new feature work

At handoff base commit `53ed8a9e...`:

- **Forge CI:** PASS
- **Forge Cloud Smoke:** PASS
- **Forge Browser Smoke:** FAIL — 10 passed, 6 failed

Browser Smoke run: GitHub Actions run **37857112767**.

### Six failing browser tests to fix

1. **Studio visualizes colliders and round-trips custom prefab hierarchies**
   - Expected collider diagnostics:
     `Prefab_Block:3.50:4.25:2.75:0.50:1.25:-0.75`
   - Received:
     `Block:2.00:4.25:2.75:0.50:1.25:-0.75`
   - Investigate collider proxy rebuild/diagnostics after rename and Size X editing.

2. **Trigger volumes fire enter and exit hooks without blocking the player**
   - After adding Trigger, `data-trigger-volume-count` remains `0` instead of `1`.
   - Inspect component edit -> entity rebuild/configureTrigger path.

3. **Player health supports damage heal death and respawn**
   - Auto-respawn branch remains `data-player-dead="true"` after the expected delay.
   - Inspect dead-player update path and whether script/player lifecycle or timing prevents `respawn()`.

4. **Hazard component creates a Trigger and deals repeated player damage**
   - Automatically-added Trigger is visible in Inspector but runtime diagnostics remain `data-trigger-volume-count="0"`.
   - Likely shares the same underlying Trigger rebuild/configuration regression as failure #2.

5. **Studio imports GLB animations and audio assets**
   - `Fit Proxy To Visual` no longer logs/executes the expected fit after switching the imported model collider to Box.
   - Output stops after `Mode updated` + model reload.
   - Verify Inspector action survives rebuild and async GLB reload.

6. **Core Relay template is a playable complete-game benchmark**
   - `moveAlongWorldAxis(...)` times out before reaching the target coordinate.
   - Preserve real WASD acceptance; fix controller/test route/focus/calibration rather than bypassing gameplay with teleportation.

## Verification requirement

Do not claim this stack is stable until all of these pass from the current tip:

```bash
npm install
npm run check
npm run build
npm run test:browser
npm run test:cloud
```

GitHub Actions equivalents:

- Forge CI
- Forge Browser Smoke
- Forge Cloud Smoke

A build/typecheck alone is not sufficient proof of Studio/runtime behavior.

## Recommended continuation order

1. Check out/update `feature/v05-stabilization`.
2. Reproduce/fix Trigger creation/rebuild regression first because it blocks Trigger + Hazard tests.
3. Fix collider proxy authoring/rebuild diagnostics and GLB Fit Proxy path together.
4. Fix player auto-respawn.
5. Fix Core Relay real-WASD benchmark.
6. Run the entire Browser Smoke suite again.
7. Run CI + Cloud Smoke.
8. Only after the stack is green, continue creator/gameplay work.

## Files most relevant to the current failures

- `src/editor/EditorApp.ts`
- `src/engine/ForgeEngine.ts`
- `src/engine/ScriptRuntime.ts`
- `src/player/PlayerController.ts`
- `src/types.ts`
- `tests/forge-smoke.spec.ts`
- `public/scenes/core-relay.forge.json`
- `index.html`
- `src/styles.css`

## Documentation map

- `CONTINUE_HERE.md` — **this live handoff / first file for continuation**
- `AGENTS.md` — rules for AI/coding agents
- `docs/CURRENT_STATE.md` — current capability and limitation inventory
- `docs/PROJECT_HISTORY.md` — chronological implementation history
- `docs/RECOVERY.md` — recovery/handoff guidance
- `docs/ARCHITECTURE.md` — architecture
- `docs/ROADMAP.md` — broader roadmap
- `docs/PROJECT_HELIOS.md` — long-term benchmark game

## Product constraints that must not be lost

- Keep Forge's own classic/approachable identity; do not turn it into a generic enterprise editor.
- Humans, scripts, AI, and Studio should edit the same canonical project representation.
- Prefer semantic scene data/components/stable APIs over UI automation hacks.
- Do not silently break old scenes.
- Do not add features without acceptance coverage when they affect Studio/runtime gameplay.
- Final delivery must include a review pass for errors, integration issues, and regressions.

## Handoff update rule

Whenever substantial work continues from here, update this file before handing the project to another agent. At minimum refresh:

- canonical continuation branch
- top PR
- current head commit
- green/red checks
- open regressions
- immediate next task

That keeps the repository self-describing and prevents another agent from restarting or duplicating work.
