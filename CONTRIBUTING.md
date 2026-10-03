# Contributing to Forge =]

Forge is being built as an AI-first social game creation platform.

Before major work, read docs/VISION.md, docs/PRODUCT_PRINCIPLES.md, docs/ARCHITECTURE.md, docs/ROADMAP.md, docs/STYLE_GUIDE.md, docs/AI_CONTRACT.md, and docs/PROJECT_HELIOS.md.

## Repository rule

Correct repository: NeuroVendas/-game-engine

Do not make Forge changes in unrelated repositories.

In particular, do not modify NeuroVendas/happy-coding or NeuroVendas/evolution-neuro unless a separate task explicitly requires it.

## Branching

Do not develop substantial features directly on main.

Use branches such as forge-v0.4, feature/prefabs, feature/script-editor, or fix/player-camera.

Keep branches focused when possible.

## Pull requests

A PR should explain what changed, why it changed, what creator problem it solves, how it was tested, and what remains incomplete.

Large product-direction changes should reference the relevant vision or architecture document.

## Required checks

Before merging:

- npm install
- npm run check
- npm run build
- Forge CI must pass

## Scene changes

When editing .forge.json files:

- keep entity IDs stable
- use semantic names
- avoid duplicate IDs
- avoid meaningless object names
- do not silently change unrelated entities
- preserve deterministic formatting when practical

## Engine changes

Prefer small modules, testable behavior, explicit data, readable TypeScript, stable serialization.

Avoid hidden global state, unexplained magic numbers, architecture for hypothetical future needs, editor-only data that runtime cannot understand, and runtime-only data that cannot be represented in project files.

## UX standard

A feature is not finished merely because the engine can technically do it.

For creator-facing features, verify that a user can reasonably discover and use it.

## AI compatibility

New major systems should answer: Can an AI inspect and modify this system through stable structured data?

If not, document why and how AI compatibility will be added.

## Project Helios

When possible, add or test systems in Project Helios.

Helios is the benchmark game for Forge.

## Merge discipline

Do not merge failing CI.

Do not merge knowingly broken editor interactions.

Do not merge large generated changes without inspecting the diff.

Do not silently change product identity or core principles.
