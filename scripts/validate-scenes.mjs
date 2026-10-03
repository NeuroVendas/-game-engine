import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../public/scenes/", import.meta.url);
const files = (await readdir(root)).filter((file) => file.endsWith(".forge.json"));

if (files.length === 0) {
  throw new Error("No .forge.json scenes found.");
}

for (const file of files) {
  const document = JSON.parse(await readFile(new URL(file, root), "utf8"));

  if (document.format !== "forge.scene") throw new Error(`${file}: invalid format`);
  if (document.version !== 1) throw new Error(`${file}: unsupported scene version`);
  if (!Array.isArray(document.entities)) throw new Error(`${file}: entities must be an array`);

  const ids = new Set();
  for (const [index, entity] of document.entities.entries()) {
    if (!entity.id || !entity.name || !entity.kind) {
      throw new Error(`${file}: entity #${index} missing id/name/kind`);
    }
    if (ids.has(entity.id)) throw new Error(`${file}: duplicate entity id "${entity.id}"`);
    ids.add(entity.id);

    if (!Array.isArray(entity.position) || entity.position.length !== 3) {
      throw new Error(`${file}: ${entity.id} has invalid position`);
    }
  }

  console.log(`✓ ${file}: ${document.entities.length} entities`);
}

console.log(`Validated ${files.length} Forge scene(s).`);
