# Forge =] — Recovery and cross-AI handoff

> If prior ChatGPT/Work/Codex history is unavailable, **start at [the root handoff](../CONTINUE_HERE.md)**. It contains the live test evidence, last verified commit, outstanding regression and links to the PR stack.
>
> Updated 2026-10-08 (America/Asuncion).

## Identity / safety

Repository: **`NeuroVendas/-game-engine`** — https://github.com/NeuroVendas/-game-engine

Do not modify `NeuroVendas/happy-coding` or `NeuroVendas/evolution-neuro` for Forge. Keep credentials, Supabase keys/tokens and user information out of repository docs/logs.

## Actual work branches, NOT default main

- **Working branch**: `feature/v05-stabilization` — [PR #26](https://github.com/NeuroVendas/-game-engine/pull/26), stacked on PR #25.
- **Full release candidate**: `release/v05-rc` — [PR #27](https://github.com/NeuroVendas/-game-engine/pull/27) targeting `main`, **draft / unmerged until all verification passes**.
- Historical basis `forge-v0.5` is **not** the latest development tip. `forge-v0.4` is the older platform/creator foundation.
- `forge-preview-v05` is **generated output**, published by `.github/workflows/deploy-preview.yml` from `forge-v0.5`, **not automatically from the latest PR #26 or #27**. Do not hand-edit it or assume it is the latest runtime.
- Do **not** merge parallel overlap PR #19 into the active stacked code indiscriminately.
- The handoff's last tested head on October 8: `af9f80d0c0248a1982e369bd0ba5836b43ac6b57`; **consult current GitHub head and checks first** as documentation commits may follow.

## Live release blocker

At the last verified source revision:
- **Forge CI / TypeScript / build: PASS**.
- **Forge Cloud Smoke: PASS**.
- **Forge Browser Smoke: FAIL**, specifically flaky real-WASD navigation in the Core Relay benchmark.
- The latest log shows `moveAlongWorldAxis(page, "z", -3.1)` timing out near position `[-7.46,-2.30]`, with `destination=[-7.476,-3.1]`, `velocity=[0.00,5.05]`, `camera=[0,1]`.
- Browser-focused GLB import/Fit/Reset and platform/player tests were passing in that run; previously fixed Trigger/Hazard/respawn bugs must remain covered.
- For evidence, see [Browser failed run 37869295897](https://github.com/NeuroVendas/-game-engine/actions/runs/37869295897), [CI success 37869295914](https://github.com/NeuroVendas/-game-engine/actions/runs/37869295914), [Cloud success 37869295899](https://github.com/NeuroVendas/-game-engine/actions/runs/37869295899).
- **Do not weaken the test or use teleportation to make Core Relay pass.** Investigate real movement input, camera basis, waypoint control/overshoot, collision surfaces and browser frame timing. Complete reproducible full browser pass is mandatory.

## First commands for next agent

```bash
git clone https://github.com/NeuroVendas/-game-engine.git
cd -- -game-engine
git fetch --all
git switch feature/v05-stabilization
npm install
npm run check
npm run build
npx playwright test -g "Core Relay template is a playable complete-game benchmark"
npm run test:browser
npm run test:cloud
```

## Read in order

1. `CONTINUE_HERE.md` — live status and next action; authoritative.
2. `AGENTS.md` — code-assistant rules.
3. `docs/CURRENT_STATE.md` — capability inventory.
4. `docs/PROJECT_HISTORY.md` — implementation milestones.
5. `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, `docs/VISION.md`, `docs/PROJECT_HELIOS.md`, `docs/AI_CONTRACT.md`.
6. `src/types.ts`, `src/editor/EditorApp.ts`, `src/engine/ForgeEngine.ts`, `src/engine/ScriptRuntime.ts`, `src/player/PlayerController.ts`, `src/main.ts`, `tests/forge-smoke.spec.ts`, `public/scenes/core-relay.forge.json`.

## Technical and product invariants

Stack: TypeScript, Vite, Babylon.js, Supabase, Playwright, GitHub Actions. Dedicated Supabase Forge project is in region `sa-east-1`, integration at `src/platform/CloudStore.ts`.

- Forge =] is an original, approachable, AI-first social game creation Studio and 3D runtime. Keep its classic, creator-friendly identity.
- Code, Studio and AI must edit the **same structured `forge.scene v1` representation** defined by `src/types.ts`.
- Play mode is temporary simulation; Stop restores authoring state unless deliberately applied.
- `public/scenes/core-relay.forge.json` is the small-game acceptance benchmark with interactables, scripts, UI, sounds, collision, win state and VFX. `docs/PROJECT_HELIOS.md` is the long-term reactor game benchmark.
- Do not reintroduce compile-only confidence, hidden errors, fragile preview assumptions, fake cloud data, private account cache leaks, or destructive/unreviewed merge strategies.
- Update tests alongside behavior; update root handoff and history before finishing. The user expects an actual final bug/integration review.

## How to finish release safely

Fix Core Relay input/path instability, run **all** commands above on the current head, inspect passing GitHub checks on the PR, and fast-forward `release/v05-rc` from the proven stabilization commit. Keep the release draft if any gate is red; after all checks are green and preview/playtest is reviewed, merge PR #27 to main once, without duplicating already stacked feature PRs. Re-check post-merge status and document the shipped SHA.
