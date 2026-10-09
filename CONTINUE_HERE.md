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
- **GitHub Pages is now enabled and production deployment succeeded.** GitHub Pages deployment [run 37965541139, attempt 2](https://github.com/NeuroVendas/-game-engine/actions/runs/37965541139) reports `Reported success!` and its environment URL is **https://neurovendas.github.io/-game-engine/**.
- Deployed Pages build revision: `592430aaada1643719610611a08353b3daa23da4`, a checked build of v0.5.0. This is separate from the subsequent GitHub Release metadata and documentation commits; no gameplay source changes occurred between the tested release candidate and this Pages build.
- **External visual smoke not independently confirmed**: automation verified GitHub's successful deployment logs and public environment URL, but a direct HTTP request from the assistant runtime was blocked by DNS/network resolution. The user should open the public URL and verify the launcher, Studio, Core Relay and cloud sign-in.
- The static preview branch `forge-preview-v05` remains separate from the Pages production publishing mechanism.
- **Current task:** get user's browser confirmation of the published website and repair any live UX/auth routing issues discovered. The Windows installer and auto-update idea remain deferred until the user elects to start them.

## Auth email verification hotfix (2026-10-09)

- **PR [#29](https://github.com/NeuroVendas/-game-engine/pull/29) merged into main:** `fd8592a5078c5753ebcf0dabecfdf1d472199637`.
- **QA on PR:** CI PASS, Cloud Smoke PASS, focused auth + gameplay regressions PASS, full Playwright Browser Smoke **18/18 PASS** ([run 37972717381](https://github.com/NeuroVendas/-game-engine/actions/runs/37972717381)).
- **Pages production:** [run 37974062446](https://github.com/NeuroVendas/-game-engine/actions/runs/37974062446) PASS; external HTTP fetch of [revision.txt](https://neurovendas.github.io/-game-engine/revision.txt) returned exactly `fd8592a5078c5753ebcf0dabecfdf1d472199637`, and live [homepage](https://neurovendas.github.io/-game-engine/) was accessible.
- **Root cause:** Supabase Auth used old `http://localhost:3000` for default redirect; logs showed one successful signup email confirmation and a subsequent invalid/used one-time token. The user updated Supabase **Site URL and Redirect URLs** to `https://neurovendas.github.io/-game-engine/` in Auth URL Configuration.
- **Code fix:** explicit `emailRedirectTo` for signup and resend targeting the current Forge pathname; actionable expired-link feedback; prevent stale callback/session failure from incorrectly marking Forge Cloud offline.
- **Remaining verification:** a live new-user sign-up through Supabase mail delivery was **not** performed after the fix (automated tests mocked signup/resend to avoid creating accounts/sending mail). User's already-verified account can sign in with the existing credentials. Do not assert end-to-end email delivery without a new manual test.
- **Other work:** Echo Vault/UI/character improvements live in draft [PR #28](https://github.com/NeuroVendas/-game-engine/pull/28), NOT released in the public v0.5 hotfix. Do not overwrite main with that feature stack without reviewing/rebasing its changes.

## Echo Vault and Studio usability release — 2026-10-09

- **PR [#28](https://github.com/NeuroVendas/-game-engine/pull/28) MERGED into `main`** in commit `42069324032839aad16bad6ead73a10f4d01ca2e`. This follows and PRESERVES PR #29 email-confirmation fixes.
- **Released capabilities:** Echo Vault as second official catalog game plus editable/remixable template (`public/scenes/echo-vault.forge.json`, 119 entities); 3 interactive energy nodes, health hazards, checkpoint, HUD/UI, scripts including `ModuleScript`, particle VFX, sound, vault unlock and victory trigger. Studio toolbar wraps to prevent scrolling/clipping; `Code` now opens a real script editor, creating a Script for an empty scene; Forge Scout player visual upgraded with jacket, hair, cuffs and boots while retaining collision and player controls.
- **Quality gate:** CI PASS, Cloud Smoke PASS, focused browser PASS including a full real-WASD mission playthrough and all 22 Browser Smoke scenarios PASS ([workflow 37977797737](https://github.com/NeuroVendas/-game-engine/actions/runs/37977797737), **22/22**).
- **Production:** [Publish Forge v0.5 Website workflow 37979557033](https://github.com/NeuroVendas/-game-engine/actions/runs/37979557033) PASS. External HTTP verification of `https://neurovendas.github.io/-game-engine/revision.txt` returned **`42069324032839aad16bad6ead73a10f4d01ca2e`** exactly, and the public homepage served the Echo Vault template.
- **Next:** ask user to hard-refresh the [live Forge](https://neurovendas.github.io/-game-engine/), open **Games → ECHO VAULT**, test player visuals/controls and **Develop → Templates → Echo Vault**. User-provided visual screenshots are the next feedback source. Consider modern Studio panel layout, dockable script workspace, UI typography and player animations after confirming this release; desktop installer remains a future separate feature.
- Keep automated QA on actual game interactions. A prior acceptance route failed behind a solid crate after the third relay, and was fixed by routing around the crate using real WASD. No collisions were disabled and no player teleports were added to test code.

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
