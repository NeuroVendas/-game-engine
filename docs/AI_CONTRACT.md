# Forge AI Contract

Forge is intentionally designed so an AI agent can edit the same world that a human edits visually.

## Rule

The AI should never need to "fake mouse movement" to build a map.

The canonical game data is:

- scene JSON
- prefabs
- components
- scripts
- Forge AI operations

## Scene format

Scenes live in `public/scenes/*.forge.json`.

Each entity has a stable `id`, semantic `name`, primitive or prefab type, transform, appearance, and optional components.

Example:

```json
{
  "id": "ClassifiedDoorA",
  "name": "Classified Blast Door",
  "kind": "box",
  "position": [8, 3, -12],
  "size": [5, 6, 0.8],
  "components": {
    "Collider": { "enabled": true },
    "Interactable": { "enabled": true },
    "Door": { "openHeight": 7 },
    "Script": { "name": "door.basic" }
  }
}
```

## Runtime AI operations

`src/ai/ForgeAI.ts` exposes structured operations.

Example batch:

```json
[
  {
    "op": "create_box",
    "name": "Maintenance Console",
    "position": [4, 1, -3],
    "size": [3, 2, 1],
    "color": "#43515a"
  },
  {
    "op": "move",
    "id": "MasterConsole",
    "position": [0, 2, 11]
  }
]
```

Supported in the current v0.4 development branch:

- `create_box`
- `place_prefab`
- `set_components`
- `rename`
- `move`
- `rotate`
- `scale`
- `delete`

The first semantic prefab library includes blast doors, control consoles, catwalks, and coolant pumps.

Future operations should include:

- `create_room`
- `create_corridor`
- `connect_rooms`
- `remove_component`
- `attach_script`
- `set_material`
- `set_lighting`
- `create_ui`

## Safety of edits

AI-authored changes should be made on a branch, validated, built, previewed, and then merged.

Expected loop:

```text
EDIT
  ↓
VALIDATE SCENES
  ↓
TYPECHECK
  ↓
BUILD
  ↓
PREVIEW
  ↓
MERGE
```

This contract is part of the engine architecture, not an optional plugin.
