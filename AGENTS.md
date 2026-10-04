# AGENTS.md — Forge =]

This file is for AI agents and automated coding assistants working in this repository.

## Repository identity

Correct repository: NeuroVendas/-game-engine

Never modify NeuroVendas/happy-coding or NeuroVendas/evolution-neuro as part of Forge work unless the user explicitly gives a separate task involving them.

## Product identity

Forge =] is an AI-first social game creation platform and 3D engine.

Its identity is inspired by the simplicity, creativity, social energy, and approachable building culture of classic online sandbox game platforms from the late 2000s / early 2010s.

Do not turn Forge into a generic enterprise-looking engine.

Do not clone another platform's branding, assets, or UI pixel-for-pixel.

Preserve Forge's own identity.

## Mandatory reading

Before major work, read:

- docs/CURRENT_STATE.md
- docs/PROJECT_HISTORY.md
- docs/RECOVERY.md
- docs/VISION.md
- docs/PRODUCT_PRINCIPLES.md
- docs/ARCHITECTURE.md
- docs/ROADMAP.md
- docs/STYLE_GUIDE.md
- docs/AI_CONTRACT.md
- docs/PROJECT_HELIOS.md
- CONTRIBUTING.md

## Core rule

Humans, developers, and AI must edit the same project representation.

Do not design systems that require AI to automate mouse movement in the editor.

Prefer scene JSON, semantic IDs, components, scripts, prefabs, stable APIs, and structured operations.

## Current technology

Current package version is 0.5.0 and active Creator Experience development is on forge-v0.5. forge-v0.4 is the historical platform/creator-foundation branch.

Current stack: TypeScript, Vite, Babylon.js, Supabase, scene JSON, Playwright, and GitHub Actions.

Do not replace core technology casually.

Major stack changes require a concrete reason and explicit approval.

## Engineering style

Prefer readable TypeScript, small modules, stable data contracts, explicit behavior, deterministic serialization, and creator-facing usability.

Avoid premature abstraction, unnecessary dependencies, opaque generated code, giant single files, silent schema changes, and magic behavior with no representation in project data.

## Verification

After meaningful changes:

1. validate scenes
2. typecheck
3. build
4. run Browser Smoke for Studio/runtime/platform behavior
5. run Cloud Smoke when cloud/platform behavior is relevant
6. inspect failures
7. fix before reporting completion

Use:

- npm run check
- npm run build
- npm run test:browser
- npm run test:cloud

Do not claim runtime/editor behavior is working merely because TypeScript/build succeeded.

## Benchmark games

Project Helios remains the large long-term benchmark for systems such as doors, clearance, power, alarms, multiplayer, persistence and publishing.

Core Relay is the v0.5 small-game acceptance benchmark. Use it to prove creator ergonomics, scripts/modules, interaction, UI, sound, environment and complete-game flow.

Do not let Forge become a collection of unused engine features.

## Product priority

CREATE -> PLAYTEST -> SCRIPT -> BUILD REAL GAME -> MULTIPLAYER -> SOCIAL -> PUBLISH

Monetization systems are not an early priority.

## When uncertain

Preserve simplicity.

Preserve reversibility.

Preserve semantic data.

Preserve Forge identity.
