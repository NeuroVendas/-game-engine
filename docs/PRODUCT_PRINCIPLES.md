# Forge =] Product Principles

These principles are mandatory guidance for contributors.

## 1. Simplicity before sophistication

Prefer a system that a beginner understands immediately over a technically impressive system that requires documentation to perform basic tasks.

A Block should be easy to create. A Door should be easy to configure. A Script should be easy to attach. A game should be easy to run.

## 2. Fast feedback

The ideal loop is CREATE -> PLAY -> CHANGE -> PLAY AGAIN.

Avoid workflows that require long export, bake, compile, or configuration steps for ordinary game creation.

## 3. Visual, code, and AI are peers

No creation mode should be treated as a second-class wrapper.

Visual edits must serialize cleanly. Code edits must appear correctly in the editor. AI edits must produce ordinary project data that humans can inspect.

## 4. Semantic objects over anonymous geometry

Prefer names such as BlastDoor, Console, CoolantPump, ReactorCore over Mesh_0392, Cube_28, or Object_104.

Stable names and IDs make the engine easier for humans, scripts, and AI.

## 5. Blocky is a strength

Forge should embrace modular, geometric building.

Simple geometry is not a temporary placeholder style. It is a valid visual language and a major accessibility advantage.

Advanced imported assets remain supported.

## 6. Do not imitate complexity

Do not add enterprise-grade abstractions just because professional engines have them.

Every major system must justify itself through creator value.

## 7. Project Helios is the benchmark

When possible, prove engine systems inside Project Helios.

Doors become classified blast doors. Power becomes the reactor grid. Scripting becomes reactor systems. Multiplayer becomes reactor crew. UI becomes control consoles. Permissions become clearance. Audio becomes alarms and machinery.

## 8. Reversible edits

AI and editor operations should support predictable undo, history, or source control.

Destructive opaque edits are unacceptable.

## 9. Good defaults

A new project should already have sane camera, lighting, physics, controls, player spawn, materials, and scene organization.

Do not force beginners to assemble basic runtime infrastructure manually.

## 10. Social play matters

Forge is not only a scene editor.

The eventual product is a creation + play + social platform.

## 11. Monetization is not an early priority

Do not prioritize virtual currency, marketplace economy, paid discovery, creator payout systems, or cosmetic monetization before the creation, gameplay, multiplayer, accounts, and publishing loops are solid.

## 12. Modern underneath, simple on top

Forge may use modern rendering, networking, hosting, databases, testing, and build systems internally.

Creators should not need to understand those systems to make a game.
