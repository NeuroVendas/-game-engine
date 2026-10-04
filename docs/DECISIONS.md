# Forge =] Decision Log

This file records product and architecture decisions that future contributors should not casually reverse.

## D001 — Forge is AI-first

Status: Accepted

Forge is designed from the beginning so AI can inspect and modify worlds through stable structured data.

Consequences:

- scene data must be serializable
- semantic IDs and names matter
- components and scripts must be addressable
- AI should not depend on editor mouse automation
- changes should be reviewable and reversible

## D002 — Classic sandbox simplicity is core identity

Status: Accepted

Forge is inspired by the approachable creation and social feel of classic online sandbox platforms from the late 2000s / early 2010s.

This is a product identity decision, not a temporary prototype limitation.

Consequences:

- blocky modular building is first-class
- the editor should remain understandable
- the default world style can be simple by design
- advanced rendering is optional, not mandatory for good-looking games
- do not copy another platform's protected visual assets or UI exactly

## D003 — Project Helios is the benchmark game

Status: Accepted

The reactor game Project Helios is the first serious game built with Forge and is used to prove engine systems.

Consequences:

- new features should be exercised in Helios where practical
- avoid building unused engine systems
- engine ergonomics are judged by whether Helios is pleasant to build

## D004 — Current technical foundation

Status: Accepted for v0.3

Current stack:

- TypeScript
- Vite
- Babylon.js
- JSON scene documents
- GitHub
- GitHub Actions

Major replacements require a concrete technical reason and explicit approval.

## D005 — Visual, code, and AI edit the same project

Status: Accepted

Forge does not maintain separate incompatible authoring paths.

Visual editor changes, source-code changes, and AI changes must converge on the same canonical project data.

## D006 — Play mode must not silently mutate source scenes

Status: Accepted

Runtime simulation is temporary unless the creator explicitly applies a change.

Play/Stop should preserve editor state.

## D007 — Social platform is part of the long-term product

Status: Accepted

Forge is intended to grow beyond a standalone engine into a creation + play + social platform.

Long-term areas include accounts, profiles, friends, presence, servers, join-friend, publishing, favorites, badges, and communities.

## D008 — Monetization is not an early milestone

Status: Accepted

Virtual currency, marketplace economy, paid discovery, payouts, and cosmetic economies are intentionally deferred until creation, gameplay, multiplayer, social, and publishing loops are strong.

## How to change a decision

Do not silently overwrite a decision.

If a decision must change:

1. add a new decision entry
2. reference the old decision
3. explain why the old assumption no longer holds
4. discuss the change in a pull request
5. update affected documentation


## D009 — Real browser testing is part of correctness

Status: Accepted

Typecheck/build alone is not sufficient proof for Studio/Play behavior. Forge has compiled while collisions, startup or controls were broken.

Consequences:

- behavior changes require Browser Smoke where practical
- runtime failures should be surfaced
- tests should exercise real gameplay/editor flows

## D010 — Forge remains local-first even with Forge Cloud

Status: Accepted

Basic creation/play should work for guests where practical. Cloud adds identity, sync, publishing and social behavior.

Consequences:

- local browser projects remain valid
- sign-in can sync local work
- backend failure should not destroy local authoring
- guest state must not expose a previous account's private cloud data

## D011 — Supabase is the current Forge platform backend

Status: Accepted for the current generation

Forge Cloud uses Supabase for Auth, PostgreSQL, RLS and platform data.

Consequences:

- do not reuse unrelated old projects
- preserve RLS
- migrations stay explicit
- future replacement requires a migration plan

## D012 — Renderer enhancements must degrade gracefully

Status: Accepted

Optional rendering quality must not make Forge unusable when a browser/GPU lacks a feature.

Consequences:

- capability-dependent effects fall back safely
- boot reliability beats an optional visual effect

## D013 — Conventional creator controls beat novelty

Status: Accepted

Distinct identity is welcome, but common 3D editing should remain predictable. The custom six-axis experiment was removed after proving less usable.

## D014 — Creator scripts are currently trusted code

Status: Accepted for current development

The present runtime is creator-code infrastructure, not a hardened sandbox for hostile arbitrary public code.

Consequences:

- do not advertise it as a security sandbox
- production public UGC execution will require stronger isolation
