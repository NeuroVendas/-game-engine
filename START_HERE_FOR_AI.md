# Forge =] — START HERE if you are a new AI, Work, Codex or contributor

**This file is a pointer, not the canonical development handoff.** The default `main` branch is an older base and does **not** represent the latest Forge v0.5 implementation.

**Current code:** [`feature/v05-stabilization`](https://github.com/NeuroVendas/-game-engine/tree/feature/v05-stabilization) — [PR #26](https://github.com/NeuroVendas/-game-engine/pull/26).

**Authoritative handoff (read it before coding):** [`CONTINUE_HERE.md` on the current development branch](https://github.com/NeuroVendas/-game-engine/blob/feature/v05-stabilization/CONTINUE_HERE.md).

**Disaster recovery:** [`docs/RECOVERY.md` on the current development branch](https://github.com/NeuroVendas/-game-engine/blob/feature/v05-stabilization/docs/RECOVERY.md).

**Full v0.5 release candidate:** [draft PR #27 to `main`](https://github.com/NeuroVendas/-game-engine/pull/27), branch [`release/v05-rc`](https://github.com/NeuroVendas/-game-engine/tree/release/v05-rc).

### State at handoff — 2026-10-08, user local time

- The Forge v0.5 editor, runtime, launcher/cloud, player physics, scripts, GLB workflows, triggers/hazards, prefabs, VFX, UI, audio and Core Relay benchmark are implemented in the **feature branch**, not in `main`.
- CI/TypeScript/build and Cloud Smoke passed on **pre-documentation head `af9f80d0c0248a1982e369bd0ba5836b43ac6b57`**.
- Browser Smoke **FAILED** due to intermittent real-WASD movement/waypoint control in the Core Relay browser playthrough. See root handoff for exact failing coordinates and GitHub Actions links.
- **Do not declare the v0.5 release finished or merge draft PR #27 while any browser test is red.** Do not bypass collision with teleportation, or weaken tests to fake a green build.
- Read the current feature branch HEAD and latest Actions runs first; docs-only commits can advance branch tips after the last tested source SHA.

### How to continue

```bash
git clone https://github.com/NeuroVendas/-game-engine.git
cd -- -game-engine
git switch feature/v05-stabilization
cat CONTINUE_HERE.md
npm install
npm run check
npm run build
npx playwright test -g "Core Relay template is a playable complete-game benchmark"
npm run test:browser
npm run test:cloud
```

Keep the existing stacked PR history (#13–#26), the product's creator-friendly Forge identity and the single canonical `forge.scene v1` project model. Do not switch to an unrelated repository. When finishing, update the branch's root handoff and verify before delivering.

This pointer exists on `main` for discovery only. **Its presence is not evidence of a release or stable gameplay.**
