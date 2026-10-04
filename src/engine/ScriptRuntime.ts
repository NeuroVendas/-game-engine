import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Scene } from "@babylonjs/core/scene";
import type { ForgeEntity, ForgeScriptKind } from "../types";

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
  onClick?(): void;
  onKeyDown?(code: string): void;
  onKeyUp?(code: string): void;
  onDestroy?(): void;
}

export type ForgeScriptFactory = (context: ForgeScriptContext) => ForgeScript;

type ScriptCallback = (...args: unknown[]) => void;

interface ForgeNodeAPI {
  readonly id: string;
  readonly name: string;
  x: number;
  y: number;
  z: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  visible: boolean;
  move(x: number, y: number, z: number): void;
  setPosition(x: number, y: number, z: number): void;
  setRotation(xDegrees: number, yDegrees: number, zDegrees: number): void;
  rotate(xDegrees: number, yDegrees: number, zDegrees: number): void;
  setScale(x: number, y: number, z: number): void;
  setColor(hex: string): void;
}

interface RuntimeAudioAPI {
  play(idOrName: string): boolean;
  pause(idOrName: string): boolean;
  stop(idOrName: string): boolean;
  setVolume(idOrName: string, volume: number): boolean;
}

interface RuntimeUIAPI {
  setText(idOrName: string, text: string): boolean;
  show(idOrName: string, visible: boolean): boolean;
}

interface ForgeUserAPI {
  readonly self: ForgeNodeAPI;
  readonly parent: ForgeNodeAPI | null;
  readonly script: {
    readonly name: string;
    readonly kind: ForgeScriptKind;
  };
  readonly world: {
    get(idOrName: string): ForgeNodeAPI | null;
    find(name: string): ForgeNodeAPI | null;
    all(): ForgeNodeAPI[];
  };
  readonly input: {
    isDown(code: string): boolean;
  };
  readonly audio: RuntimeAudioAPI;
  readonly ui: RuntimeUIAPI;
  readonly time: {
    wait(seconds: number): Promise<void>;
  };
  readonly math: {
    clamp(value: number, min: number, max: number): number;
    lerp(a: number, b: number, t: number): number;
  };
  log(message: unknown): void;
  warn(message: unknown): void;
  error(message: unknown): void;
  onStart(callback: () => void): void;
  onUpdate(callback: (dt: number) => void): void;
  onInteract(callback: ScriptCallback): void;
  onClick(callback: () => void): void;
  onKeyDown(callback: (code: string) => void): void;
  onKeyUp(callback: (code: string) => void): void;
  onDestroy(callback: () => void): void;
  on(eventName: string, callback: ScriptCallback): void;
  emit(eventName: string, ...args: unknown[]): void;
  module(value: unknown): void;
  require(name: string): unknown;
}

interface CompileResult {
  script: ForgeScript;
  moduleValue: unknown;
}

export class ScriptRuntime {
  private readonly factories = new Map<string, ForgeScriptFactory>();
  private readonly active = new Map<string, ForgeScript>();
  private readonly modules = new Map<string, unknown>();
  private readonly events = new Map<string, Set<ScriptCallback>>();
  private readonly keys = new Set<string>();
  private audioApi: RuntimeAudioAPI = {
    play: () => false,
    pause: () => false,
    stop: () => false,
    setVolume: () => false
  };
  private uiApi: RuntimeUIAPI = {
    setText: () => false,
    show: () => false
  };

  constructor(
    private readonly scene: Scene,
    private readonly log: (message: string) => void
  ) {
    window.addEventListener("keydown", (event) => {
      this.keys.add(event.code);
      for (const [entityId, script] of this.active) {
        this.safeCall(entityId, "onKeyDown", () => script.onKeyDown?.(event.code));
      }
    });

    window.addEventListener("keyup", (event) => {
      this.keys.delete(event.code);
      for (const [entityId, script] of this.active) {
        this.safeCall(entityId, "onKeyUp", () => script.onKeyUp?.(event.code));
      }
    });

    window.addEventListener("blur", () => this.keys.clear());
  }

  register(name: string, factory: ForgeScriptFactory): void {
    this.factories.set(name, factory);
  }

  setAudioAPI(api: RuntimeAudioAPI): void {
    this.audioApi = api;
  }

  setUIAPI(api: RuntimeUIAPI): void {
    this.uiApi = api;
  }

  attach(entity: ForgeEntity, node: AbstractMesh): void {
    const component = entity.components?.Script;
    if (!component || component.enabled === false) return;

    const kind: ForgeScriptKind = component.kind ?? "Script";
    let script: ForgeScript | null = null;

    if (component.source?.trim()) {
      const result = this.compileUserScript(entity, node, component.source);
      if (!result) return;

      if (kind === "ModuleScript") {
        this.modules.set(component.name, result.moduleValue);
        this.modules.set(entity.id, result.moduleValue);
        this.log(`[${entity.name}] module loaded`);
        return;
      }

      script = result.script;
    } else {
      if (kind === "ModuleScript") {
        this.log(`Missing module source: ${component.name} on ${entity.name}`);
        return;
      }

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

    this.active.set(entity.id, script);
    this.safeCall(entity.name, "onStart", () => script?.onStart?.());
  }

  detach(entityId: string): void {
    const script = this.active.get(entityId);
    if (script) this.safeCall(entityId, "onDestroy", () => script.onDestroy?.());
    this.active.delete(entityId);
  }

  stopAll(): void {
    for (const [entityId, script] of this.active) {
      this.safeCall(entityId, "onDestroy", () => script.onDestroy?.());
    }
    this.active.clear();
    this.modules.clear();
    this.events.clear();
    this.keys.clear();
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

  uiClick(entityId: string): void {
    const script = this.active.get(entityId);
    if (!script) return;
    this.safeCall(entityId, "onClick", () => script.onClick?.());
  }

  private compileUserScript(entity: ForgeEntity, node: AbstractMesh, source: string): CompileResult | null {
    const script: ForgeScript = {};
    const self = this.createNodeAPI(node);
    const parent = node.parent && "position" in node.parent
      ? this.createNodeAPI(node.parent as AbstractMesh)
      : null;

    let moduleValue: unknown = undefined;
    const component = entity.components?.Script;
    const kind: ForgeScriptKind = component?.kind ?? "Script";

    const api: ForgeUserAPI = {
      self,
      parent,
      script: {
        name: component?.name ?? entity.id,
        kind
      },
      world: {
        get: (idOrName: string) => this.findNode(idOrName),
        find: (name: string) => this.findNode(name),
        all: () => {
          const seen = new Set<string>();
          const nodes: ForgeNodeAPI[] = [];
          for (const mesh of this.scene.meshes) {
            const metadata = mesh.metadata as { forgeEntityId?: string } | null;
            if (!metadata?.forgeEntityId || seen.has(metadata.forgeEntityId)) continue;
            seen.add(metadata.forgeEntityId);
            nodes.push(this.createNodeAPI(mesh));
          }
          return nodes;
        }
      },
      input: {
        isDown: (code: string) => this.keys.has(code)
      },
      audio: {
        play: (idOrName: string) => this.audioApi.play(idOrName),
        pause: (idOrName: string) => this.audioApi.pause(idOrName),
        stop: (idOrName: string) => this.audioApi.stop(idOrName),
        setVolume: (idOrName: string, volume: number) => this.audioApi.setVolume(idOrName, volume)
      },
      ui: {
        setText: (idOrName: string, text: string) => this.uiApi.setText(idOrName, text),
        show: (idOrName: string, visible: boolean) => this.uiApi.show(idOrName, visible)
      },
      time: {
        wait: (seconds: number) => new Promise((resolve) => {
          window.setTimeout(resolve, Math.max(0, Number(seconds) || 0) * 1000);
        })
      },
      math: {
        clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)),
        lerp: (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t))
      },
      log: (message: unknown) => this.log(`[${entity.name}] ${String(message)}`),
      warn: (message: unknown) => this.log(`WARN [${entity.name}] ${String(message)}`),
      error: (message: unknown) => this.log(`ERROR [${entity.name}] ${String(message)}`),
      onStart: (callback: () => void) => {
        script.onStart = callback;
      },
      onUpdate: (callback: (dt: number) => void) => {
        script.onUpdate = callback;
      },
      onInteract: (callback: ScriptCallback) => {
        script.onInteract = callback as (actor: AbstractMesh) => void;
      },
      onClick: (callback: () => void) => {
        script.onClick = callback;
      },
      onKeyDown: (callback: (code: string) => void) => {
        script.onKeyDown = callback;
      },
      onKeyUp: (callback: (code: string) => void) => {
        script.onKeyUp = callback;
      },
      onDestroy: (callback: () => void) => {
        script.onDestroy = callback;
      },
      on: (eventName: string, callback: ScriptCallback) => {
        const bucket = this.events.get(eventName) ?? new Set<ScriptCallback>();
        bucket.add(callback);
        this.events.set(eventName, bucket);
      },
      emit: (eventName: string, ...args: unknown[]) => {
        for (const callback of this.events.get(eventName) ?? []) {
          try {
            callback(...args);
          } catch (error) {
            this.log(`EVENT ERROR • ${eventName}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      },
      module: (value: unknown) => {
        moduleValue = value;
      },
      require: (name: string) => {
        if (!this.modules.has(name)) {
          throw new Error(`Module "${name}" is not loaded. Put ModuleScripts before dependent scripts in Explorer.`);
        }
        return this.modules.get(name);
      }
    };

    try {
      const safeName = (component?.name || entity.id).replace(/[^a-zA-Z0-9_.-]/g, "_");
      const execute = new Function(
        "Forge",
        `"use strict";\n${source}\n//# sourceURL=forge://scripts/${safeName}.js`
      ) as (forge: ForgeUserAPI) => void;

      execute(api);
      return { script, moduleValue };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log(`SCRIPT ERROR • ${entity.name}: ${message}`);
      return null;
    }
  }

  private findNode(idOrName: string): ForgeNodeAPI | null {
    const match = this.scene.meshes.find((mesh) => {
      const metadata = mesh.metadata as { forgeEntityId?: string; forgeEntityName?: string } | null;
      return mesh.name === idOrName
        || metadata?.forgeEntityId === idOrName
        || metadata?.forgeEntityName === idOrName;
    });

    return match ? this.createNodeAPI(match) : null;
  }

  private createNodeAPI(node: AbstractMesh): ForgeNodeAPI {
    const metadata = node.metadata as { forgeEntityId?: string; forgeEntityName?: string } | null;
    const toDegrees = (value: number) => value * 180 / Math.PI;
    const toRadians = (value: number) => value * Math.PI / 180;

    return {
      id: metadata?.forgeEntityId ?? node.name,
      name: metadata?.forgeEntityName ?? node.name,
      get x() { return node.position.x; },
      set x(value: number) { node.position.x = Number(value) || 0; },
      get y() { return node.position.y; },
      set y(value: number) { node.position.y = Number(value) || 0; },
      get z() { return node.position.z; },
      set z(value: number) { node.position.z = Number(value) || 0; },
      get rotationX() { return toDegrees(node.rotation.x); },
      set rotationX(value: number) { node.rotation.x = toRadians(Number(value) || 0); },
      get rotationY() { return toDegrees(node.rotation.y); },
      set rotationY(value: number) { node.rotation.y = toRadians(Number(value) || 0); },
      get rotationZ() { return toDegrees(node.rotation.z); },
      set rotationZ(value: number) { node.rotation.z = toRadians(Number(value) || 0); },
      get scaleX() { return node.scaling.x; },
      set scaleX(value: number) { node.scaling.x = Number(value) || 0.001; },
      get scaleY() { return node.scaling.y; },
      set scaleY(value: number) { node.scaling.y = Number(value) || 0.001; },
      get scaleZ() { return node.scaling.z; },
      set scaleZ(value: number) { node.scaling.z = Number(value) || 0.001; },
      get visible() { return node.isEnabled(); },
      set visible(value: boolean) { node.setEnabled(Boolean(value)); },
      move(x: number, y: number, z: number) {
        node.position.addInPlace(new Vector3(Number(x) || 0, Number(y) || 0, Number(z) || 0));
      },
      setPosition(x: number, y: number, z: number) {
        node.position.set(Number(x) || 0, Number(y) || 0, Number(z) || 0);
      },
      setRotation(xDegrees: number, yDegrees: number, zDegrees: number) {
        node.rotation.set(toRadians(Number(xDegrees) || 0), toRadians(Number(yDegrees) || 0), toRadians(Number(zDegrees) || 0));
      },
      rotate(xDegrees: number, yDegrees: number, zDegrees: number) {
        node.rotation.addInPlace(new Vector3(
          toRadians(Number(xDegrees) || 0),
          toRadians(Number(yDegrees) || 0),
          toRadians(Number(zDegrees) || 0)
        ));
      },
      setScale(x: number, y: number, z: number) {
        node.scaling.set(Number(x) || 0.001, Number(y) || 0.001, Number(z) || 0.001);
      },
      setColor(hex: string) {
        if (!(node.material instanceof StandardMaterial)) return;
        try {
          node.material.diffuseColor = Color3.FromHexString(hex);
        } catch {
          // Creator input errors should not crash the game loop.
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
