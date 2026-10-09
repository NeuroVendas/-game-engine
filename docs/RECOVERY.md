# Forge =] — recovery / cross-AI guide

**Authoritative first step:** read [`../CONTINUE_HERE.md`](../CONTINUE_HERE.md). All important decisions, verified results and next tasks are recorded there.

**Repository:** `NeuroVendas/-game-engine`. Not `NeuroVendas/happy-coding` or `NeuroVendas/evolution-neuro`.

**Current release:** Forge `0.5.0` is in **`main`** after [PR #27](https://github.com/NeuroVendas/-game-engine/pull/27), merged 2026-10-09 with commit `ec68a21d815aaf7eba06117ef030ebb50ebede28`. Feature stack PRs #13–#26, `feature/v05-stabilization`, `release/v05-rc` and `forge-v0.5` are historical. No need to remerge. Parallel PR #19 is overlapping and must not be merged blindly.

**Release verification at source commit `c51b083454e19ff5ff513047ccc7ea7c40807807`:** CI/build PASS; Cloud PASS; 3/3 focused browser tests PASS twice; full 16/16 browser tests PASS twice — [dev run](https://github.com/NeuroVendas/-game-engine/actions/runs/37961664515), [release run](https://github.com/NeuroVendas/-game-engine/actions/runs/37961840395). Post-merge main may receive further docs/preview-only commits.

**Generated preview:** workflow `.github/workflows/deploy-preview.yml` publishes `main` build output into `forge-preview-v05`. The preview branch is **not editable source**; its `revision.txt` records the built `main` commit. Verify the workflow successfully published before saying a live preview is ready. Do not hand-edit or force-push build artifacts.

## Rebuild and validate

```bash
git clone https://github.com/NeuroVendas/-game-engine.git
cd -- -game-engine
git switch main
git pull --ff-only
npm install
npm run check
npm run build
npm run test:browser
npm run test:cloud
```

The canonical `forge.scene` v1 schema is `src/types.ts`, Studio `src/editor/EditorApp.ts`, rendering/world `src/engine/ForgeEngine.ts`, scripts `src/engine/ScriptRuntime.ts`, player `src/player/PlayerController.ts`, cloud `src/platform/CloudStore.ts`, acceptance `tests/forge-smoke.spec.ts`, playable benchmark `public/scenes/core-relay.forge.json`.

Stack: TypeScript, Vite, Babylon.js, Supabase, Playwright, GitHub Actions. Supabase dedicated Forge region `sa-east-1`; never publish secrets in documentation. Play is reversible simulation, Stop returns to authoring state. AI, scripts and Studio all work against canonical scene data. Core Relay is the playable small-game benchmark; Project Helios is the longer-term reactor game benchmark.

Read `AGENTS.md`, `docs/CURRENT_STATE.md`, `docs/PROJECT_HISTORY.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/PROJECT_HELIOS.md`. Create a new feature branch from **main** for further work; use real gameplay and regression checks, and update `CONTINUE_HERE.md` before handing over.
