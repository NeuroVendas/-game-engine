# Forge =] Vision

## What Forge is

Forge =] is an AI-first social game creation platform and 3D engine.

Its identity is inspired by the simplicity, creativity, social energy, and approachable building culture of classic online sandbox platforms from roughly the late 2000s to early 2010s.

Forge is not a clone of any existing platform.

The goal is to combine simple building, fast iteration, social multiplayer, accessible scripting, modern rendering and infrastructure, first-class AI editing, human-readable project files, and a strong creator-first identity.

The core feeling should be:

Open Forge, make something quickly, test it immediately, and play it with other people.

## Identity

Forge should feel like an old-school internet game platform rebuilt with modern technology.

The default aesthetic should favor:

- clean block-based geometry
- simple materials
- strong silhouettes
- readable colors
- compact UI
- obvious buttons
- low friction
- playful presentation
- deliberate retro-web influence
- modern rendering only where it improves the experience

The default style is intentionally simple enough that a creator can build a useful room, machine, obstacle, or game without needing Blender.

Advanced games may still use imported models, animation, PBR materials, particles, shaders, and modern rendering.

Forge's visual identity is a default and a philosophy, not a hard content restriction.

## Product promise

Forge supports three equally valid ways to create.

1. Visual editing: drag, select, move, rotate, scale, build from primitives and prefabs, edit properties and components.
2. Code: scripts, components, SDK, project files.
3. AI: semantic scene editing, structured operations, scene JSON, scripts, validation, reversible changes.

All three must edit the same project representation.

## Core design rule

The AI must never depend on fake mouse movement to create or modify a game.

Worlds, gameplay, scripts, prefabs, and components must remain addressable through stable structured data.

## Social direction

Forge should eventually support profiles, friends, presence, servers, join friend, published games, creator pages, favorites, badges, and communities later.

The initial social philosophy is simple:

build things + play things + friends

Do not make monetization the center of the platform.

## Creation philosophy

Forge should be easy enough for a beginner to make something useful in minutes.

Default primitives should include Block, Wedge, Cylinder, Sphere, Truss, Spawn, Seat, Light, Decal, Sound, and Script.

Semantic objects should grow on top of those primitives: Door, BlastDoor, Console, Pump, Reactor, Vehicle, NPC, Trigger, Checkpoint.

## Project Helios

Project Helios, the reactor game, is Forge's first benchmark game.

Forge should be developed against real needs from Project Helios.

If a proposed engine feature does not help creators build or play a real game, it should be questioned before being prioritized.

The engine serves the game; the game pressure-tests the engine.

## Long-term goal

A creator should eventually be able to open Forge, start from an empty world or template, build visually or describe changes to AI, add gameplay through components or scripts, press Play immediately, invite friends, publish the game, and keep iterating without leaving the platform.
