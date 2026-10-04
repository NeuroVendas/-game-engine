import { readdir, readFile } from "node:fs/promises";

const root = new URL("../public/scenes/", import.meta.url);
const files = (await readdir(root)).filter((file) => file.endsWith(".forge.json"));

const allowedKinds = new Set([
  "box",
  "wedge",
  "sphere",
  "capsule",
  "cylinder",
  "ground",
  "empty",
  "model"
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

  if (document.environment !== undefined) {
    if (!document.environment || typeof document.environment !== "object") {
      throw new Error(`${file}: environment must be an object`);
    }
    if (document.environment.fogDensity !== undefined && !Number.isFinite(document.environment.fogDensity)) {
      throw new Error(`${file}: environment.fogDensity must be finite`);
    }
  }

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

    if (
      entity.transparency !== undefined
      && (!Number.isFinite(entity.transparency) || entity.transparency < 0 || entity.transparency > 1)
    ) {
      throw new Error(`${file}: ${entity.id} transparency must be between 0 and 1`);
    }
    if (entity.texture !== undefined && typeof entity.texture !== "string") {
      throw new Error(`${file}: ${entity.id} texture must be a string`);
    }
    if (entity.textureFileName !== undefined && typeof entity.textureFileName !== "string") {
      throw new Error(`${file}: ${entity.id} textureFileName must be a string`);
    }

    if (entity.parentId !== undefined && typeof entity.parentId !== "string") {
      throw new Error(`${file}: ${entity.id} parentId must be a string`);
    }

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

    if (components.Light) {
      if (!["point", "spot"].includes(components.Light.type)) {
        throw new Error(`${file}: ${entity.id} Light.type is invalid`);
      }
      if (components.Light.intensity !== undefined && !Number.isFinite(components.Light.intensity)) {
        throw new Error(`${file}: ${entity.id} Light.intensity must be finite`);
      }
    }

    if (components.Sound) {
      if (typeof components.Sound.src !== "string") {
        throw new Error(`${file}: ${entity.id} Sound.src must be a string`);
      }
      if (components.Sound.fileName !== undefined && typeof components.Sound.fileName !== "string") {
        throw new Error(`${file}: ${entity.id} Sound.fileName must be a string`);
      }
      if (components.Sound.volume !== undefined && !Number.isFinite(components.Sound.volume)) {
        throw new Error(`${file}: ${entity.id} Sound.volume must be finite`);
      }
    }

    if (components.Particle) {
      const particle = components.Particle;
      if (particle.enabled !== undefined && typeof particle.enabled !== "boolean") {
        throw new Error(`${file}: ${entity.id} Particle.enabled must be boolean`);
      }
      if (particle.autoplay !== undefined && typeof particle.autoplay !== "boolean") {
        throw new Error(`${file}: ${entity.id} Particle.autoplay must be boolean`);
      }
      if (particle.preset !== undefined && !["energy", "sparks", "smoke"].includes(particle.preset)) {
        throw new Error(`${file}: ${entity.id} Particle.preset is invalid`);
      }
      for (const field of ["emitRate", "capacity", "lifetime", "size", "speed"]) {
        if (particle[field] !== undefined && !Number.isFinite(particle[field])) {
          throw new Error(`${file}: ${entity.id} Particle.${field} must be finite`);
        }
      }
      if (particle.capacity !== undefined && (!Number.isInteger(particle.capacity) || particle.capacity < 16 || particle.capacity > 5000)) {
        throw new Error(`${file}: ${entity.id} Particle.capacity must be an integer from 16 to 5000`);
      }
    }

    if (components.UI) {
      if (!["text", "button", "panel"].includes(components.UI.type)) {
        throw new Error(`${file}: ${entity.id} UI.type is invalid`);
      }
    }

    if (components.Model && typeof components.Model.src !== "string") {
      throw new Error(`${file}: ${entity.id} Model.src must be a string`);
    }

    if (components.Spawn && typeof components.Spawn.enabled !== "boolean") {
      throw new Error(`${file}: ${entity.id} Spawn.enabled must be boolean`);
    }

    if (components.Script) {
      if (typeof components.Script.name !== "string" || !components.Script.name.trim()) {
        throw new Error(`${file}: ${entity.id} Script.name is required`);
      }
      if (
        components.Script.kind !== undefined
        && !["Script", "LocalScript", "ModuleScript"].includes(components.Script.kind)
      ) {
        throw new Error(`${file}: ${entity.id} Script.kind is invalid`);
      }
      if (components.Script.enabled !== undefined && typeof components.Script.enabled !== "boolean") {
        throw new Error(`${file}: ${entity.id} Script.enabled must be boolean`);
      }
      if (components.Script.source !== undefined && typeof components.Script.source !== "string") {
        throw new Error(`${file}: ${entity.id} Script.source must be a string`);
      }
      const hasCustomSource = typeof components.Script.source === "string" && components.Script.source.trim().length > 0;
      if (!hasCustomSource && !knownScripts.has(components.Script.name)) {
        throw new Error(`${file}: ${entity.id} references unknown built-in script "${components.Script.name}"`);
      }
    }
  }

  for (const entity of document.entities) {
    if (entity.parentId && !ids.has(entity.parentId)) {
      throw new Error(`${file}: ${entity.id} references missing parentId "${entity.parentId}"`);
    }
    if (entity.parentId === entity.id) {
      throw new Error(`${file}: ${entity.id} cannot parent itself`);
    }
  }

  const entityById = new Map(document.entities.map((entity) => [entity.id, entity]));
  for (const entity of document.entities) {
    const visited = new Set([entity.id]);
    let parentId = entity.parentId;

    while (parentId) {
      if (visited.has(parentId)) {
        throw new Error(`${file}: hierarchy cycle detected at "${entity.id}"`);
      }
      visited.add(parentId);
      parentId = entityById.get(parentId)?.parentId;
    }
  }

  console.log(`✓ ${file}: ${document.entities.length} entities`);
}

console.log(`Validated ${files.length} Forge scene(s).`);
