import type { ForgeEngine } from "../engine/ForgeEngine";
import type { ForgePrefabName } from "../engine/prefabs";
import type { ForgeComponents, ForgeEntity, Vec3 } from "../types";

export type ForgeAIOperation =
  | {
      op: "create_box";
      name: string;
      position: Vec3;
      size: Vec3;
      color?: string;
    }
  | {
      op: "place_prefab";
      prefab: ForgePrefabName;
      position: Vec3;
      rotation?: Vec3;
    }
  | {
      op: "set_components";
      id: string;
      components: ForgeComponents;
    }
  | {
      op: "rename";
      id: string;
      name: string;
    }
  | {
      op: "move";
      id: string;
      position: Vec3;
    }
  | {
      op: "rotate";
      id: string;
      rotation: Vec3;
    }
  | {
      op: "scale";
      id: string;
      scale: Vec3;
    }
  | {
      op: "delete";
      id: string;
    };

export interface ForgeAIBatchResult {
  ok: boolean;
  applied: number;
  errors: string[];
}

export class ForgeAI {
  private sequence = 0;

  constructor(private readonly forge: ForgeEngine) {}

  execute(operation: ForgeAIOperation): void {
    switch (operation.op) {
      case "create_box": {
        const id = this.makeId(operation.name);
        const entity: ForgeEntity = {
          id,
          name: operation.name,
          kind: "box",
          position: operation.position,
          size: operation.size,
          color: operation.color ?? "#66727c",
          components: {
            Collider: { enabled: true }
          }
        };
        this.forge.createEntity(entity);
        return;
      }

      case "place_prefab": {
        const entity = this.forge.createPrefab(operation.prefab);
        const mesh = this.requireMesh(entity.id);
        mesh.position.set(...operation.position);

        if (operation.rotation) {
          mesh.rotation.set(
            operation.rotation[0] * Math.PI / 180,
            operation.rotation[1] * Math.PI / 180,
            operation.rotation[2] * Math.PI / 180
          );
        }

        this.forge.syncEntityFromMesh(entity.id);
        return;
      }

      case "set_components": {
        const entity = this.forge.getEntity(operation.id);
        if (!entity) throw new Error(`Unknown entity: ${operation.id}`);
        entity.components = {
          ...(entity.components ?? {}),
          ...structuredClone(operation.components)
        };
        return;
      }

      case "rename": {
        const entity = this.forge.getEntity(operation.id);
        if (!entity) throw new Error(`Unknown entity: ${operation.id}`);
        entity.name = operation.name.trim() || entity.name;
        return;
      }

      case "move": {
        const mesh = this.requireMesh(operation.id);
        mesh.position.set(...operation.position);
        this.forge.syncEntityFromMesh(operation.id);
        return;
      }

      case "rotate": {
        const mesh = this.requireMesh(operation.id);
        mesh.rotation.set(
          operation.rotation[0] * Math.PI / 180,
          operation.rotation[1] * Math.PI / 180,
          operation.rotation[2] * Math.PI / 180
        );
        this.forge.syncEntityFromMesh(operation.id);
        return;
      }

      case "scale": {
        const mesh = this.requireMesh(operation.id);
        mesh.scaling.set(...operation.scale);
        this.forge.syncEntityFromMesh(operation.id);
        return;
      }

      case "delete":
        if (!this.forge.getEntity(operation.id)) {
          throw new Error(`Unknown entity: ${operation.id}`);
        }
        this.forge.deleteEntity(operation.id);
        return;
    }
  }

  batch(operations: ForgeAIOperation[]): ForgeAIBatchResult {
    const errors: string[] = [];
    let applied = 0;

    for (const operation of operations) {
      try {
        this.execute(operation);
        applied += 1;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    return {
      ok: errors.length === 0,
      applied,
      errors
    };
  }

  private requireMesh(id: string) {
    const mesh = this.forge.getMesh(id);
    if (!mesh) throw new Error(`Unknown entity: ${id}`);
    return mesh;
  }

  private makeId(name: string): string {
    this.sequence += 1;
    const slug = name
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48) || "Entity";
    return `${slug}_AI_${this.sequence}`;
  }
}
