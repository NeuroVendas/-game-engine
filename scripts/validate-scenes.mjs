import { readdir, readFile } from "node:fs/promises";

const root = new URL("../public/scenes/", import.meta.url);
const files = (await readdir(root)).filter((file) => file.endsWith(".forge.json"));

const allowedKinds = new Set([
  "box",
  "wedge",
  "sphere",
  "capsule",
  "cylinder",
  "ground"
]);

const knownScripts = new Set([
  "door.basic",
  "reactor.pulse",
  "console.status"
]);

function assertVec3(file, entityId, field, value, required = false) {
  if (value === undefined && !required) return;
  if (!Array.isArray(value) || value.length !== 3 || value.some((item) => !Number.isFinite(item))) {
    throw new Error(`${file}: ${entityId} has invalid ${field}`);
  }
}

if (files.length === 0) {
  throw new Error("No .forge.json scenes found.");
}

for (const file of files) {
  const document = JSON.parse(await readFile(new URL(file, root), "utf8"));

  if (document.format !== "forge.scene") throw new Error(`${file}: invalid format`);
  if (document.version !== 1) throw new Error(`${file}: unsupported scene version`);
  if (typeof document.name !== "string" || !document.name.trim()) {
    throw new Error(`${file}: scene name is required`);
  }
  if (!Array.isArray(document.entities)) throw new Error(`${file}: entities must be an array`);

  assertVec3(file, "<scene>", "playerSpawn", document.playerSpawn);

  const ids = new Set();

  for (const [index, entity] of document.entities.entries()) {
    if (!entity.id || !entity.name || !entity.kind) {
      throw new Error(`${file}: entity #${index} missing id/name/kind`);
    }
    if (ids.has(entity.id)) throw new Error(`${file}: duplicate entity id "${entity.id}"`);
    ids.add(entity.id);

    if (!allowedKinds.has(entity.kind)) {
      throw new Error(`${file}: ${entity.id} uses unsupported kind "${entity.kind}"`);
    }

    assertVec3(file, entity.id, "position", entity.position, true);
    assertVec3(file, entity.id, "rotation", entity.rotation);
    assertVec3(file, entity.id, "scale", entity.scale);
    assertVec3(file, entity.id, "size", entity.size);

    const components = entity.components ?? {};

    if (components.Collider && typeof components.Collider.enabled !== "boolean") {
      throw new Error(`${file}: ${entity.id} Collider.enabled must be boolean`);
    }

    if (components.Interactable && typeof components.Interactable.enabled !== "boolean") {
      throw new Error(`${file}: ${entity.id} Interactable.enabled must be boolean`);
    }

    if (components.Door?.openHeight !== undefined && !Number.isFinite(components.Door.openHeight)) {
      throw new Error(`${file}: ${entity.id} Door.openHeight must be finite`);
    }

    if (components.Clearance) {
      if (!Number.isInteger(components.Clearance.level) || components.Clearance.level < 0) {
        throw new Error(`${file}: ${entity.id} Clearance.level must be a non-negative integer`);
      }
    }

    if (components.PowerConsumer) {
      if (typeof components.PowerConsumer.bus !== "string" || !components.PowerConsumer.bus.trim()) {
        throw new Error(`${file}: ${entity.id} PowerConsumer.bus is required`);
      }
      if (components.PowerConsumer.draw !== undefined && !Number.isFinite(components.PowerConsumer.draw)) {
        throw new Error(`${file}: ${entity.id} PowerConsumer.draw must be finite`);
      }
    }

    if (components.Reactor) {
      if (components.Reactor.power !== undefined && !Number.isFinite(components.Reactor.power)) {
        throw new Error(`${file}: ${entity.id} Reactor.power must be finite`);
      }
      if (components.Reactor.temperature !== undefined && !Number.isFinite(components.Reactor.temperature)) {
        throw new Error(`${file}: ${entity.id} Reactor.temperature must be finite`);
      }
    }

    if (components.Script) {
      if (typeof components.Script.name !== "string" || !components.Script.name.trim()) {
        throw new Error(`${file}: ${entity.id} Script.name is required`);
      }
      if (!knownScripts.has(components.Script.name)) {
        throw new Error(`${file}: ${entity.id} references unknown script "${components.Script.name}"`);
      }
    }
  }

  console.log(`✓ ${file}: ${document.entities.length} entities`);
}

console.log(`Validated ${files.length} Forge scene(s).`);
