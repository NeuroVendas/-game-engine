import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Scene } from "@babylonjs/core/scene";
import type { ForgeEntity } from "../types";

export interface ForgeScriptContext {
  entity: ForgeEntity;
  node: AbstractMesh;
  scene: Scene;
  log: (message: string) => void;
}

export interface ForgeScript {
  onStart?(): void;
  onUpdate?(dt: number): void;
  onInteract?(actor: AbstractMesh): void;
  onDestroy?(): void;
}

export type ForgeScriptFactory = (context: ForgeScriptContext) => ForgeScript;

type ScriptCallback = (...args: any[]) => void;

interface ForgeNodeAPI {
  readonly id: string;
  readonly name: string;
  x: number;
  y: number;
  z: number;
  move(x: number, y: number, z: number): void;
  setPosition(x: number, y: number, z: number): void;
  rotate(xDegrees: number, yDegrees: number, zDegrees: number): void;
  setColor(hex: string): void;
}

interface ForgeUserAPI {
  readonly self: ForgeNodeAPI;
  readonly world: {
    get(idOrName: string): ForgeNodeAPI | null;
  };
  log(message: unknown): void;
  onStart(callback: () => void): void;
  onUpdate(callback: (dt: number) => void): void;
  onInteract(callback: (actor: unknown) => void): void;
  onDestroy(callback: () => void): void;
}

export class ScriptRuntime {
  private factories = new Map<string, ForgeScriptFactory>();
  private active = new Map<string, ForgeScript>();

  constructor(
    private readonly scene: Scene,
    private readonly log: (message: string) => void
  ) {}

  register(name: string, factory: ForgeScriptFactory): void {
    this.factories.set(name, factory);
  }

  attach(entity: ForgeEntity, node: AbstractMesh): void {
    const component = entity.components?.Script;
    if (!component || component.enabled === false) return;

    let script: ForgeScript | null = null;

    if (component.source?.trim()) {
      script = this.compileUserScript(entity, node, component.source);
    } else {
      const factory = this.factories.get(component.name);
      if (!factory) {
        this.log(`Missing script: ${component.name} on ${entity.name}`);
        return;
      }

      script = factory({
        entity,
        node,
        scene: this.scene,
        log: this.log
      });
    }

    if (!script) return;

    this.active.set(entity.id, script);
    this.safeCall(entity.name, "onStart", () => script?.onStart?.());
  }

  detach(entityId: string): void {
    const script = this.active.get(entityId);
    if (script) {
      this.safeCall(entityId, "onDestroy", () => script.onDestroy?.());
    }
    this.active.delete(entityId);
  }

  tick(dt: number): void {
    for (const [entityId, script] of this.active) {
      this.safeCall(entityId, "onUpdate", () => script.onUpdate?.(dt));
    }
  }

  interact(entityId: string, actor: AbstractMesh): void {
    const script = this.active.get(entityId);
    if (!script) return;
    this.safeCall(entityId, "onInteract", () => script.onInteract?.(actor));
  }

  private compileUserScript(entity: ForgeEntity, node: AbstractMesh, source: string): ForgeScript | null {
    const script: ForgeScript = {};
    const self = this.createNodeAPI(node);

    const api: ForgeUserAPI = {
      self,
      world: {
        get: (idOrName: string) => {
          const match = this.scene.meshes.find((mesh) => {
            const metadata = mesh.metadata as { forgeEntityId?: string; forgeEntityName?: string } | null;
            return mesh.name === idOrName
              || metadata?.forgeEntityId === idOrName
              || metadata?.forgeEntityName === idOrName;
          });
          return match ? this.createNodeAPI(match) : null;
        }
      },
      log: (message: unknown) => this.log(`[${entity.name}] ${String(message)}`),
      onStart: (callback: () => void) => {
        script.onStart = callback;
      },
      onUpdate: (callback: (dt: number) => void) => {
        script.onUpdate = callback;
      },
      onInteract: (callback: ScriptCallback) => {
        script.onInteract = callback;
      },
      onDestroy: (callback: () => void) => {
        script.onDestroy = callback;
      }
    };

    try {
      const safeName = (entity.components?.Script?.name || entity.id).replace(/[^a-zA-Z0-9_.-]/g, "_");
      const execute = new Function(
        "Forge",
        `"use strict";\n${source}\n//# sourceURL=forge://scripts/${safeName}.js`
      ) as (forge: ForgeUserAPI) => void;

      execute(api);
      return script;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log(`SCRIPT ERROR • ${entity.name}: ${message}`);
      return null;
    }
  }

  private createNodeAPI(node: AbstractMesh): ForgeNodeAPI {
    const metadata = node.metadata as { forgeEntityId?: string; forgeEntityName?: string } | null;

    return {
      id: metadata?.forgeEntityId ?? node.name,
      name: metadata?.forgeEntityName ?? node.name,
      get x() {
        return node.position.x;
      },
      set x(value: number) {
        node.position.x = Number(value) || 0;
      },
      get y() {
        return node.position.y;
      },
      set y(value: number) {
        node.position.y = Number(value) || 0;
      },
      get z() {
        return node.position.z;
      },
      set z(value: number) {
        node.position.z = Number(value) || 0;
      },
      move(x: number, y: number, z: number) {
        node.position.addInPlace(new Vector3(Number(x) || 0, Number(y) || 0, Number(z) || 0));
      },
      setPosition(x: number, y: number, z: number) {
        node.position.set(Number(x) || 0, Number(y) || 0, Number(z) || 0);
      },
      rotate(xDegrees: number, yDegrees: number, zDegrees: number) {
        node.rotation.addInPlace(new Vector3(
          (Number(xDegrees) || 0) * Math.PI / 180,
          (Number(yDegrees) || 0) * Math.PI / 180,
          (Number(zDegrees) || 0) * Math.PI / 180
        ));
      },
      setColor(hex: string) {
        if (!(node.material instanceof StandardMaterial)) return;
        try {
          node.material.diffuseColor = Color3.FromHexString(hex);
        } catch {
          // Invalid creator input should not kill the game loop.
        }
      }
    };
  }

  private safeCall(entityName: string, hook: string, action: () => void): void {
    try {
      action();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log(`SCRIPT ERROR • ${entityName}.${hook}: ${message}`);
    }
  }
}
