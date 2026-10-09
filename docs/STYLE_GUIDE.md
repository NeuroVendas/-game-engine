# Forge =] Style Guide

## Brand

Primary product name: Forge =]

Preferred capitalization: Forge or FORGE =]

Do not replace the =] identity with a generic corporate symbol.

## Product personality

Forge should feel playful, direct, creator-focused, nostalgic without being fake-vintage, simple without being childish, and technical underneath but approachable on the surface.

Avoid a generic enterprise dashboard look.

## Visual direction

Default editor/platform inspiration:

- classic internet game creation platforms
- early social web
- compact desktop-like UI
- obvious navigation
- large understandable controls
- readable hierarchy

The look should be original and should not duplicate another platform's protected branding, icons, assets, or UI pixel-for-pixel.

## Default world aesthetic

Forge's default content style should work well with blocks, wedges, cylinders, spheres, trusses, simple modular geometry, strong colors, readable materials, and geometric industrial design.

Simple geometry should look intentional.

## Editor navigation

Preferred top-level organization may include Home, Model, Terrain, Test, View, and Plugins.

Possible scene/service organization may include Workspace, Players, Lighting, Sound, UI, ServerScripts, and SharedStorage.

Names may evolve, but the creator mental model should stay simple.

## Object properties

Common object properties should be visible and understandable: Position, Size, Rotation, Color, Material, Anchored, Collision, Transparency, Components, Scripts.

Advanced options should not dominate the default inspector.

## UI rules

- Prefer words over mystery icons.
- Keep critical buttons visible.
- Avoid deeply nested settings.
- Prefer one obvious workflow over multiple equivalent workflows.
- Editor controls should have keyboard shortcuts.
- Play and Stop must always be easy to find.
- Error messages should explain what failed and where.

## Color

Forge currently uses a dark editor with bright lime accent #b7f34a.

This can evolve, but changes should preserve recognizability.

## Naming

Prefer semantic names such as MainControlRoom, BlastDoorA, CoolantPumpB, ReactorCore.

Avoid Cube14, Object2, Mesh_Final_Final2.

## Source code style

Prefer small modules, explicit names, readable TypeScript, minimal hidden magic, predictable data flow, and comments only where behavior is non-obvious.

Do not introduce architectural complexity without a concrete use case.
