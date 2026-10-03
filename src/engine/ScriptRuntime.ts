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
    const scriptName = entity.components?.Script?.name;
    if (!scriptName) return;

    const factory = this.factories.get(scriptName);
    if (!factory) {
      this.log(`Missing script: ${scriptName} on ${entity.name}`);
      return;
    }

    const script = factory({
      entity,
      node,
      scene: this.scene,
      log: this.log
    });

    this.active.set(entity.id, script);
    script.onStart?.();
  }

  detach(entityId: string): void {
    this.active.get(entityId)?.onDestroy?.();
    this.active.delete(entityId);
  }

  tick(dt: number): void {
    for (const script of this.active.values()) {
      script.onUpdate?.(dt);
    }
  }

  interact(entityId: string, actor: AbstractMesh): void {
    this.active.get(entityId)?.onInteract?.(actor);
  }
}
