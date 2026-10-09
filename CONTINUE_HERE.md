# Forge =] — CONTINUE HERE (authoritative AI handoff)

> **Last updated:** 2026-10-09 (America/Asuncion).
>
> **Repository:** [NeuroVendas/-game-engine](https://github.com/NeuroVendas/-game-engine)
>
> **CURRENT CONTINUATION BRANCH: `main`.** Forge **v0.5.0 is merged**. Release PR [#27](https://github.com/NeuroVendas/-game-engine/pull/27) merged at commit [`ec68a21d815a`](https://github.com/NeuroVendas/-game-engine/commit/ec68a21d815aaf7eba06117ef030ebb50ebede28).
>
> **Verification:** TypeScript/build ✅, Cloud Smoke ✅, **3/3 focused Browser Smoke ✅ on two independent runs**, **16/16 complete Browser Smoke ✅ on two independent runs** at tested source commit `c51b083454e19ff5ff513047ccc7ea7c40807807`. No known failing release gate.
>
> **Attention:** A successful git merge is NOT evidence that the external GitHub Pages preview is live. `.github/workflows/deploy-preview.yml` is now set to publish `main` into `forge-preview-v05`; verify the deploy workflow and `revision.txt` before claiming live preview success.

## Official public release — 2026-10-09

- **GitHub Release `v0.5.0` is published, NOT a draft:** https://github.com/NeuroVendas/-game-engine/releases/tag/v0.5.0
- **Release workflow succeeded:** https://github.com/NeuroVendas/-game-engine/actions/runs/37965658343. It checked scenes, TypeScript, production build, cloud smoke and package version. This follows two independently green full Browser Smoke suites from the tested source.
- **Public browser site is NOT LIVE yet.** Repository metadata reports `has_pages: false`. The official `Publish Forge v0.5 Website` workflow built and uploaded the artifact but Pages deployment failed with HTTP 404 ("Ensure GitHub Pages has been enabled") in https://github.com/NeuroVendas/-game-engine/actions/runs/37965541139.
- **Human one-time action required:** owner opens https://github.com/NeuroVendas/-game-engine/settings/pages and sets **Build and deployment → Source = GitHub Actions**. After enabling, re-run the failed Pages deployment workflow or launch `Publish Forge v0.5 Website` from GitHub Actions (workflow has `workflow_dispatch`). Confirm the resulting `github-pages` environment URL and deployed `revision.txt` before sharing a playable website URL.
- A generated static build in `forge-preview-v05` is **not** proof of a reachable hosted production site. Avoid claiming full public website launch until deployment succeeds.
- **Current task:** finish Pages enablement/verification and then share the confirmed public URL. The Windows installable app and auto-update feature are explicitly deferred until after the v0.5 web launch.

## 1. Start here if you are a DIFFERENT AI / Codex / Work

1. This is **Forge =]**, NOT the `happy-coding` or `evolution-neuro` repository.
2. **`main` now contains the full v0.5 stack.** Pull `main`, read `AGENTS.md`, `README.md`, `docs/CURRENT_STATE.md`, `docs/PROJECT_HISTORY.md`, `docs/RECOVERY.md`, `docs/ROADMAP.md` and `docs/ARCHITECTURE.md`.
3. Check `main`'s *latest head* before coding; the above release commit is historic and docs/preview commits may advance `main`.
4. If adding v0.6 or fixing regressions, create a **new feature branch from current `main`**. Do not restart from `forge-v0.5`, `feature/v05-stabilization` or `release/v05-rc`.
5. The historic stacked PRs #13–#26 are already contained in merged **#27**. **Do not merge them again.** PR #19 is an overlapping alternate collider implementation; never blindly merge it.
6. Keep progress in GitHub and update this handoff at the end of each session.

## 2. What is actually implemented in v0.5

- **Platform**: launch pages, game/profile pages, friends/favorites/recent plays, accounts, local/cloud projects, visibility/catalog and direct Play. Backend integrates with a dedicated Forge Supabase project via `src/platform/CloudStore.ts`.
- **Studio**: Babylon.js 3D editor, hierarchy, groups, Move/Rotate/Resize, transform snapping, object size, inspectors, Undo/Redo, quick actions, selection, F2 rename, hierarchy copy/paste/duplicate.
- **Creation/data**: `forge.scene` v1 schema, semantic scene components, prefabs, reusable project-prefab library, imported GLB/animation/audio/images, materials, sky/environment, lighting, shadows, colliders (mesh and fitted box proxy), trigger volumes, hazards.
- **Runtime/gameplay**: `Script`, `LocalScript`, `ModuleScript`; Forge runtime APIs; Forge Classic 3D avatar; camera first/third person, real WASD/jump/sprint; collision, health/damage, death/respawn/checkpoints/fall Kill Y; interactions, UI, sound and VFX.
- **Benchmark**: `public/scenes/core-relay.forge.json` complete small-game playthrough, three relays, HUD, win condition and victory VFX. `docs/PROJECT_HELIOS.md` is the ambitious reactor-game benchmark for future development.

The presence of working implementations and green smoke tests does NOT mean the v0.5 engine is feature-complete compared with major mature engines. Continue creator usability/performance tests with real projects.

## 3. Release verification evidence (October 9, 2026)

| Gate | Result |
|---|---|
| [CI / TypeScript / build](https://github.com/NeuroVendas/-game-engine/actions/runs/37961840343) | PASS |
| [Cloud Smoke](https://github.com/NeuroVendas/-game-engine/actions/runs/37961840386) | PASS |
| [Browser Smoke on dev PR](https://github.com/NeuroVendas/-game-engine/actions/runs/37961664515) | 3 focused PASS + **16/16 full PASS** |
| [Browser Smoke on release PR](https://github.com/NeuroVendas/-game-engine/actions/runs/37961840395) | 3 focused PASS + **16/16 full PASS** |
| [Merge #27](https://github.com/NeuroVendas/-game-engine/pull/27) | MERGED to `main` as `ec68a21d815a` |

Core Relay Playwright route now uses real DOM keyboard events and the genuine `PlayerController`/Babylon collision path. The test synchronizes key release to animation frames to avoid CI-side lag and does **not** teleport the player or bypass collision. The two independent full green runs are meaningful because earlier runs exposed intermittent route/collider failures.

Post-merge docs and preview workflow changes should be checked independently. Do not claim a live deployment until `forge-preview-v05/revision.txt` matches the preview workflow's built `main` commit.

## 4. How to test / build

```bash
git clone https://github.com/NeuroVendas/-game-engine.git
cd -- -game-engine
git switch main
git pull --ff-only
npm install
npm run check
npm run build
npm run test:cloud
npx playwright test -g "platform home, games, favorites, profile and direct play work|Studio imports GLB animations and audio assets|Core Relay template is a playable complete-game benchmark"
npm run test:browser
```

CI workflows under `.github/workflows/` also validate builds, cloud and browser smoke for feature/PR branches. Browser Smoke is intentionally single-worker Chromium with software WebGL and may take several minutes.

## 5. Practical next phase (user has NOT selected exact scope yet)

Continue from `main` with a **v0.6 creator-quality plan** after checking `docs/ROADMAP.md`:

- More reliable, natural movement/jump/camera through real-play benchmarks.
- Stronger GLB and character animation workflow/controller.
- UI authoring, asset browsing and performant scene editing.
- Better scripting IDE, sound mixer and composable particle/VFX tools.
- Scene/physics interaction quality and a serious Project Helios vertical slice.
- Later multiplayer/network authority, social presence and publishing quality.

Do not add another 20 UI buttons in place of actual functionality. Prefer end-to-end creator tasks: build a genuine playable game using Studio, scripting, assets, UI, audio and physics.

## 6. Engineering constraints, files and history

- `AGENTS.md` has the mandatory AI coding rules. Preserve Forge's original, approachable classic sandbox identity; do not clone Roblox assets/branding.
- Canonical serialization: `src/types.ts`. Studio, runtime and AI must edit the same scene representation.
- Key files: `src/editor/EditorApp.ts`, `src/engine/ForgeEngine.ts`, `src/player/PlayerController.ts`, `src/engine/ScriptRuntime.ts`, `src/platform/CloudStore.ts`, `tests/forge-smoke.spec.ts`.
- Historic v0.5 implementation: stacked #13, #14, #15, #16, #17, #18, #20, #21, #22, #23, #24, #25, #26, collected and MERGED via #27. Old branch `forge-v0.5` is not the released source.
- Avoid leaking tokens/secrets. Do not silently break existing scenes or cloud user data. Do not weaken acceptance checks.
- The user expects a **final review for bugs, inconsistencies, integration problems** before each delivery. Refresh this file with current branch, checks, blockers and next task on every handoff.
