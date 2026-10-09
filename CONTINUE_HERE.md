# START HERE — Forge =] v0.5 handoff (authoritative)

> Last verified: **2026-10-08 (America/Asuncion) / 2026-10-09 (GitHub UTC)**.
>
> Repo: **[NeuroVendas/-game-engine](https://github.com/NeuroVendas/-game-engine)**.
>
> **Continue development on `feature/v05-stabilization` — PR [#26](https://github.com/NeuroVendas/-game-engine/pull/26).**
>
> **Release candidate: `release/v05-rc` — draft PR [#27 → main](https://github.com/NeuroVendas/-game-engine/pull/27).**
>
> **Last tested code head BEFORE writing this handoff: `af9f80d0c0248a1982e369bd0ba5836b43ac6b57`.**
>
> **RELEASE BLOCKED: CI and Cloud Smoke pass; Browser Smoke still fails on intermittent Core Relay real-WASD navigation. Do not report v0.5 finished and do not merge #27 until all gates pass.**

## A. If you are a new AI, Work, Codex, or developer: do this FIRST

1. Read **this file**, `AGENTS.md`, `docs/RECOVERY.md`, `docs/CURRENT_STATE.md`, `docs/PROJECT_HISTORY.md`, `docs/ARCHITECTURE.md` and `docs/ROADMAP.md`. Do not assume the default `main` or `forge-v0.5` is current.
2. Inspect PRs **#26** (active stabilization) and **#27** (release candidate). **Check branch HEADs**, rather than trusting the historical SHA above: writing this handoff produces additional documentation commits.
3. Check the current GitHub Actions status for the **latest SHA**, not prior runs. If newer pushes appeared, use their results.
4. Work on `feature/v05-stabilization`; preserve edits already made. Keep `release/v05-rc` fast-forwarded to the tested stabilization tip once appropriate. Release PR #27 deliberately stays **draft** until verified.
5. **Fix remaining real gameplay/browser regression first. Do not add unrelated features.** Re-run targeted and full suites; update this document with precise results before concluding.
6. Never touch `NeuroVendas/happy-coding` or `NeuroVendas/evolution-neuro` for Forge work.

### Clone / verify

```bash
git clone https://github.com/NeuroVendas/-game-engine.git
cd -- -game-engine
git fetch --all
git switch feature/v05-stabilization
npm install
npm run check
npm run build
# Fast iteration on actual remaining benchmark:
npx playwright test -g "Core Relay template is a playable complete-game benchmark"
# Three historically fragile paths:
npx playwright test -g "platform home, games, favorites, profile and direct play work|Studio imports GLB animations and audio assets|Core Relay template is a playable complete-game benchmark"
# REQUIRED release gates:
npm run test:browser
npm run test:cloud
```

On slow CI, Playwright boots a production Vite preview in Chromium with SwiftShader/WebGL. `playwright.config.ts` uses one worker, and the entire browser suite can take ~6–7 minutes. **A successful build is NOT evidence that Editor/Play work.** Do not weaken acceptance or skip Core Relay gameplay as a release workaround.

## B. Exact current evidence (last tested head)

| Check | Result | GitHub Actions |
|---|---|---|
| Forge CI: scene validation, TS, production build | **PASS** | [run 37869295914](https://github.com/NeuroVendas/-game-engine/actions/runs/37869295914) |
| Forge Cloud Smoke | **PASS** | [run 37869295899](https://github.com/NeuroVendas/-game-engine/actions/runs/37869295899) |
| Forge Browser Smoke | **FAIL** | [run 37869295897](https://github.com/NeuroVendas/-game-engine/actions/runs/37869295897) |
| GLB import, Fit Proxy, Reset Proxy, animation/audio browser case | **PASS in last focused run** | Same Browser Smoke run; appeared as first/second passing case |
| Direct-play player/camera/jump browser case | **PASS in last focused run** | Same Browser Smoke run |
| Core Relay full gameplay / real keyboard path | **FAIL (flaky/blocked waypoint)** | Same Browser Smoke run |

**Latest Browser Smoke failure, exact last recorded:** Playwright test `Core Relay template is a playable complete-game benchmark` (file `tests/forge-smoke.spec.ts`, around line 1583) called `moveAlongWorldAxis(page, "z", -3.1)` and timed out after 16 seconds. The logged state:

```text
WASD route to z=-3.1 blocked:
position=[-7.46,-2.30]
destination=[-7.476,-3.1]
velocity=[0.00,5.05]
camera=[0,1]
```

That log follows previous oscillation near `x=-6.6`. The issue is the browser test's **input controller / waypoint tracking in a real physics world**, not evidence that all play movement is broken. Other attempts got as far as Relay B and C or fully passed; do not claim it is fixed based on one lucky pass. The test must remain a **real WASD + E playthrough**, not `Forge.player.setPosition` or other teleport shortcuts.

**Important**: Our last attempted helper changes introduced frequent toggling/braking at a waypoint. Examine actual per-frame positions/input rather than continuing to arbitrarily tweak target values. An improvement is to use a proportional or stepwise steering method that avoids alternating forward/back inputs near a target; stop at a tolerance, release movement, then wait for friction. Instrument key presses, camera basis, positions, playerGrounded, interaction prompt and collision boundaries in the test. Consider ensuring the keyboard is focused and avoiding rapid key toggles without browser frames. Keep collision geometry and true world-space behavior intact. If it genuinely uncovers a player controller/physics bug, fix the runtime and add focused coverage; don't falsify the test.

### Relevant code entry points

- `tests/forge-smoke.spec.ts` — `moveAlongWorldAxis`, `readPlayerXZ`, `expectInteractionPrompt`, the Core Relay test; test targets for A/B/C.
- `public/scenes/core-relay.forge.json` — actual positions: spawn [0, 0.1, 12]; Relay A [-7,1,-6]; Relay B [0,1,-10]; Relay C [7,1,-6]; each relay has a **solid 2.5×2×2.5 box**; interaction is proximity based.
- `src/player/PlayerController.ts` — WASD relative to camera, smooth acceleration/deceleration, capsule `moveWithCollisions`, interaction range (~3.2), diagnostics on viewport. Contains camera zoom/collision grace and jump-impulse diagnostics fixes.
- `src/engine/ForgeEngine.ts` — entity meshes, collider/trigger proxies, imported GLB animation, Fit/Reset logic, shadow scene module side-effect registration.
- `src/editor/EditorApp.ts` — Inspector, delegated `pointerdown` / `click` fit/reset actions, scene history, UI rebuild.
- `index.html`, `src/types.ts`, `src/engine/ScriptRuntime.ts` — UI, schema, scripts.

### Other regressions that ARE currently fixed in focused tests

- Collider proxy / prefab rename and size diagnostics.
- Trigger and Hazard creation + trigger volumes.
- Player health, death, respawn and kill plane.
- GLB model loading/animations; Box Proxy Fit/Reset now activates an enabled collider; note GLB geometry X offset is **-0.50** for the sample and diagnostics use stable ID `animated_triangle`, not display label `animated-triangle`.
- First-/third-person camera zoom restoration, buffered jump observability.
- Core Relay is intermittently playable end-to-end, but remains unverified reliably.

Initial 2026-10-08 handoff had 6 Browser Smoke failures (10 pass/6 fail). A later 16-test run passed **14/16**, with only camera zoom and GLB Fit failures; subsequent focused runs passed both while uncovering waypoint drift in Core Relay. This is an improvement, **not** a release green signal.

## C. Stack/branches you MUST preserve

The v0.5 implementation is a long **stack of PRs**, not a single change from `main`.

| PR | Branch | Base | Capability |
|---|---|---|---|
| #13 | `feature/v05-vfx-core-relay` | `forge-v0.5` | VFX + Core Relay |
| #14 | `feature/v05-player-feel` | #13 | Player feel / environment |
| #15 | `feature/v05-collision-prefabs` | #14 | Collision debug / prefabs |
| #16 | `feature/v05-model-animations` | #15 | GLB animations |
| #17 | `feature/v05-collider-proxies` | #16 | Mesh / Box Proxy |
| #18 | `feature/v05-project-prefab-library` | #17 | Project Prefab Library |
| #20 | `feature/v05-trigger-volumes` | #18 | Triggers, checkpoints |
| #21 | `feature/v05-player-health` | #20 | Health / death / respawn |
| #22 | `feature/v05-hazard-volumes` | #21 | Hazards |
| #23 | `feature/v05-player-kill-plane` | #22 | Kill plane |
| #24 | `feature/v05-studio-clipboard` | #23 | Hierarchy clipboard |
| #25 | `feature/v05-studio-quick-actions` | #24 | Toolbar actions / F2 |
| **#26** | **`feature/v05-stabilization`** | **#25** | **LATEST DEV TIP: integration fixes** |
| **#27** | **`release/v05-rc`** | **`main`** | **FULL STACK RELEASE CANDIDATE (DRAFT)** |

**Do not blindly merge PR #19 / `feature/v05-collider-proxy`:** this is an overlapping parallel implementation superseded by the current stack. Avoid individually merging #13–#26 on top of PR #27 as that would duplicate work. PR #27 already contains the full stacked line.

**Preview branch caveat:** `forge-preview-v05` is generated build output from `.github/workflows/deploy-preview.yml` triggered by **`forge-v0.5`**. It is NOT the current `feature/v05-stabilization` code. Don't treat preview as latest, force-push to preview by hand, or modify production deployments without explicit release validation.

## D. Implemented capabilities to preserve

Forge =] is a TypeScript/Vite/Babylon.js engine + creator Studio + social/cloud launcher, backed by Supabase and Playwright. It has:

- Editable 3D scenes, object hierarchy, move/rotate/resize, workspace inspector, undo/redo, group creation, reusable custom/project prefabs, hierarchy copy/paste/duplicate, toolbar quick actions and F2 rename.
- Primitive/collider authoring, mesh and Box Proxy collision modes, debug visualization, GLB models and embedded animations, audio, sky, lights, materials, shadows, UI widgets, particles/VFX.
- Typed scripts (`Script`, `LocalScript`, `ModuleScript`), runtime hooks/API, proximity interactivity, trigger events, hazards, powers/doors and benchmark-level features.
- Forge Classic blocky avatar; first/third-person camera, WASD/jump/sprint, editable player collision size/speed, health/damage/auto and manual respawn/checkpoints/kill plane.
- Launcher, game pages, favorites, accounts, profiles, saved projects, Forge Cloud/Supabase and basic publish/catalog/social foundations.
- Project Helios long-term benchmark; Core Relay complete smaller interactive game, win state and VFX.

**The existence of a feature in source is not the same as polished, production-ready behavior.** Maintain the product's approachable, original, classic sandbox identity, and the invariant that visual editing, code and AI operate on one canonical scene JSON representation. Don't replicate another company's branding/assets.

## E. Engineering, test and delivery rules

1. Diagnose the last failing test with actual Playwright logs; solve correctly in runtime or test according to evidence. Don't remove test coverage, bypass collision, or fake success.
2. Verify: `npm install`, `npm run check`, `npm run build`, `npx playwright test -g "Core Relay template is a playable complete-game benchmark"`, `npm run test:browser`, `npm run test:cloud`.
3. Note Browser Smoke GitHub Actions currently runs three focused cases first and then the **entire** 16-case suite. CI/Cloud/Browser workflow concurrency was adjusted to reduce duplicated runs, but check actual workflow jobs.
4. Once all checks are green on the current SHA, review UI/gameplay, commit final documentation, fast-forward release candidate #27 to the verified tip, revalidate its checks, then consider merging **#27** into `main`. Leave the draft/merge alone if any gate is red. Avoid claiming deployment success without independently verifying the deployed preview.
5. Review changed code/tests for errors, integration regressions and unintended behavior before reporting work complete. The user explicitly expects that final pass.

## F. Handoff rule — required every time

Before ending any coding session, update **this root file** with the *current* dev branch, release branch, PRs, latest test HEAD SHA, each check result and links, actual remaining bug(s), and a precise immediate task. Update `docs/RECOVERY.md` if the branch/release strategy changes; append meaningful milestones to `docs/PROJECT_HISTORY.md`. This file is the portable memory for the next AI even when no previous ChatGPT/Work conversation is accessible.
