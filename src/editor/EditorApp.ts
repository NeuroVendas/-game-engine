import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { GizmoManager } from "@babylonjs/core/Gizmos/gizmoManager";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { ForgeComponents, ForgeEntity, ForgePrimitive, ForgeSceneDocument, ForgeScriptKind } from "../types";
import { ForgeEngine } from "../engine/ForgeEngine";
import { registerDefaultScripts } from "../engine/defaultScripts";
import type { ForgePrefabName } from "../engine/prefabs";
import { PlayerController } from "../player/PlayerController";
import { HistoryManager } from "./HistoryManager";

type ToolMode = "select" | "move" | "rotate" | "scale";
type AppMode = "editor" | "play";

function must<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing UI element #${id}`);
  return element as T;
}

function degrees(value: number): number {
  return value * 180 / Math.PI;
}

function radians(value: number): number {
  return value * Math.PI / 180;
}

export class EditorApp {
  readonly forge: ForgeEngine;

  private readonly editorCamera: ArcRotateCamera;
  private readonly gizmos: GizmoManager;
  private readonly history = new HistoryManager(60);
  private readonly editorNavKeys = new Set<string>();

  private player: PlayerController | null = null;
  private mode: AppMode = "editor";
  private tool: ToolMode = "move";
  private selectedId: string | null = null;
  private playSnapshot: ForgeSceneDocument | null = null;
  private rightMouseNavigation = false;
  private editorOrbitLastX = 0;
  private editorOrbitLastY = 0;
  private snapEnabled = true;
  private moveSnap = 1;

  private readonly tree = must<HTMLDivElement>("scene-tree");
  private readonly status = must<HTMLSpanElement>("status");
  private readonly fps = must<HTMLDivElement>("fps");
  private readonly historyState = must<HTMLDivElement>("history-state");
  private readonly modeBadge = must<HTMLDivElement>("mode-badge");
  private readonly interactionPrompt = must<HTMLDivElement>("interaction-prompt");
  private readonly uiRoot = must<HTMLDivElement>("forge-ui-root");
  private readonly inspectorEmpty = must<HTMLDivElement>("inspector-empty");
  private readonly inspectorFields = must<HTMLDivElement>("inspector-fields");
  private readonly componentList = must<HTMLDivElement>("component-list");
  private readonly scriptDialog = must<HTMLDialogElement>("script-editor-dialog");
  private readonly scriptTarget = must<HTMLSpanElement>("script-editor-target");
  private readonly scriptKind = must<HTMLSelectElement>("script-kind");
  private readonly scriptName = must<HTMLInputElement>("script-name");
  private readonly scriptSource = must<HTMLTextAreaElement>("script-source");
  private scriptEditingEntityId: string | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.forge = new ForgeEngine(canvas, (message) => this.log(message));
    registerDefaultScripts(this.forge.scripts);

    this.editorCamera = new ArcRotateCamera(
      "__editor-camera",
      -Math.PI / 2.2,
      1.08,
      38,
      new Vector3(0, 5, 0),
      this.forge.scene
    );
    this.editorCamera.lowerRadiusLimit = 2;
    this.editorCamera.upperRadiusLimit = 120;
    this.editorCamera.wheelPrecision = 18;
    this.editorCamera.panningSensibility = 70;
    this.forge.scene.activeCamera = this.editorCamera;

    this.gizmos = new GizmoManager(this.forge.scene);
    this.gizmos.usePointerToAttachGizmos = false;
    this.gizmos.positionGizmoEnabled = true;
    if (this.gizmos.gizmos.positionGizmo) {
      this.gizmos.gizmos.positionGizmo.planarGizmoEnabled = false;
      this.gizmos.gizmos.positionGizmo.updateGizmoRotationToMatchAttachedMesh = false;
    }

    this.bindUI();
    this.bindScenePicking();
    this.bindKeyboard();
    this.bindEditorNavigation();
    this.forge.mountUI(this.uiRoot, false);
    this.setTool("move");
    this.updateHistoryUI();
  }

  async init(sceneDocument: ForgeSceneDocument): Promise<void> {
    this.forge.loadDocument(structuredClone(sceneDocument));
    this.history.clear();
    this.renderTree();
    this.renderInspector();
    this.syncEnvironmentInputs();
    this.forge.mountUI(this.uiRoot, false);
    this.updateHistoryUI();
    this.startLoop();
    requestAnimationFrame(() => this.forge.resize());
  }

  openDocument(sceneDocument: ForgeSceneDocument): void {
    if (this.mode === "play") this.exitPlayMode();
    this.setSelection(null);
    this.forge.loadDocument(structuredClone(sceneDocument));
    this.history.clear();
    this.renderTree();
    this.renderInspector();
    this.syncEnvironmentInputs();
    this.forge.mountUI(this.uiRoot, false);
    this.updateHistoryUI();
    this.forge.resize();
    this.log(`Opened ${sceneDocument.name}`);
  }

  returnToLauncher(): void {
    if (this.mode === "play") this.exitPlayMode();
  }

  getDocument(): ForgeSceneDocument {
    return this.forge.exportDocument();
  }

  startPlay(): void {
    this.enterPlayMode();
  }

  stopPlay(): void {
    this.exitPlayMode();
  }

  isPlayMode(): boolean {
    return this.mode === "play";
  }

  private startLoop(): void {
    let previous = performance.now();

    this.forge.engine.runRenderLoop(() => {
      const now = performance.now();
      const dt = Math.min((now - previous) / 1000, 0.05);
      previous = now;

      try {
        if (this.mode === "play") {
          this.player?.update(dt);
          this.forge.scripts.tick(dt);
        } else {
          this.updateEditorCamera(dt);
          if (this.selectedId) {
            this.forge.syncEntityFromMesh(this.selectedId);
          }
          this.canvas.dataset.editorCamera = [
            this.editorCamera.position.x.toFixed(3),
            this.editorCamera.position.y.toFixed(3),
            this.editorCamera.position.z.toFixed(3),
            this.editorCamera.target.x.toFixed(3),
            this.editorCamera.target.y.toFixed(3),
            this.editorCamera.target.z.toFixed(3)
          ].join(",");
        }

        this.forge.scene.render();
        this.fps.textContent = `${Math.round(this.forge.engine.getFps())} FPS`;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.canvas.dataset.runtimeError = message;
        this.log(`RUNTIME ERROR: ${message}`);
      }
    });

    window.addEventListener("resize", () => this.forge.resize());
  }

  private bindUI(): void {
    must<HTMLButtonElement>("tool-select").addEventListener("click", () => this.setTool("select"));
    must<HTMLButtonElement>("tool-move").addEventListener("click", () => this.setTool("move"));
    must<HTMLButtonElement>("tool-rotate").addEventListener("click", () => this.setTool("rotate"));
    must<HTMLButtonElement>("tool-scale").addEventListener("click", () => this.setTool("scale"));

    must<HTMLButtonElement>("snap-toggle").addEventListener("click", () => {
      this.snapEnabled = !this.snapEnabled;
      this.applySnapSettings();
      this.log(this.snapEnabled ? `Snap enabled at ${this.moveSnap}u / 15°.` : "Snap disabled.");
    });

    must<HTMLSelectElement>("snap-size").addEventListener("change", (event) => {
      const next = Number((event.target as HTMLSelectElement).value);
      if (Number.isFinite(next) && next > 0) {
        this.moveSnap = next;
        this.applySnapSettings();
        this.log(`Move snap: ${this.moveSnap}u.`);
      }
    });

    document.querySelectorAll<HTMLButtonElement>("[data-primitive]").forEach((button) => {
      button.addEventListener("click", () => {
        if (this.mode !== "editor") return;
        const kind = button.dataset.primitive as ForgePrimitive | undefined;
        if (!kind) return;
        this.createPrimitive(kind);
      });
    });

    document.querySelectorAll<HTMLButtonElement>("[data-object]").forEach((button) => {
      button.addEventListener("click", () => {
        if (this.mode !== "editor") return;
        const objectType = button.dataset.object;
        if (objectType) this.createStudioObject(objectType);
      });
    });

    must<HTMLButtonElement>("import-model").addEventListener("click", () => {
      must<HTMLInputElement>("model-file-input").click();
    });
    must<HTMLInputElement>("model-file-input").addEventListener("change", (event) => {
      void this.importModelFile(event);
    });

    document.querySelectorAll<HTMLButtonElement>("[data-prefab]").forEach((button) => {
      button.addEventListener("click", () => {
        if (this.mode !== "editor") return;
        const prefab = button.dataset.prefab as ForgePrefabName | undefined;
        if (!prefab) return;
        this.createPrefab(prefab);
      });
    });

    must<HTMLButtonElement>("duplicate-selected").addEventListener("click", () => this.duplicateSelected());
    must<HTMLButtonElement>("delete-selected").addEventListener("click", () => this.deleteSelected());
    must<HTMLButtonElement>("code-selected").addEventListener("click", () => this.openScriptEditor());
    must<HTMLButtonElement>("add-component").addEventListener("click", () => this.addSelectedComponent());
    must<HTMLButtonElement>("script-close").addEventListener("click", () => this.scriptDialog.close());
    must<HTMLButtonElement>("script-save").addEventListener("click", () => this.saveScriptEditor());
    must<HTMLButtonElement>("script-template").addEventListener("click", () => {
      this.scriptSource.value = this.defaultScriptSource(this.scriptKind.value as ForgeScriptKind);
    });
    this.scriptKind.addEventListener("change", () => {
      if (!this.scriptSource.value.trim()) {
        this.scriptSource.value = this.defaultScriptSource(this.scriptKind.value as ForgeScriptKind);
      }
    });
    this.scriptSource.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.code === "KeyS") {
        event.preventDefault();
        this.saveScriptEditor();
      }
      if (event.key === "Tab") {
        event.preventDefault();
        const start = this.scriptSource.selectionStart;
        const end = this.scriptSource.selectionEnd;
        this.scriptSource.setRangeText("  ", start, end, "end");
      }
    });
    must<HTMLButtonElement>("undo").addEventListener("click", () => this.undo());
    must<HTMLButtonElement>("redo").addEventListener("click", () => this.redo());

    must<HTMLButtonElement>("play").addEventListener("click", () => this.enterPlayMode());
    must<HTMLButtonElement>("stop").addEventListener("click", () => this.exitPlayMode());
    must<HTMLButtonElement>("save-local").addEventListener("click", () => this.saveLocal());
    must<HTMLButtonElement>("load-local").addEventListener("click", () => this.loadLocal());
    must<HTMLButtonElement>("import-scene").addEventListener("click", () => {
      must<HTMLInputElement>("scene-file-input").click();
    });
    must<HTMLInputElement>("scene-file-input").addEventListener("change", (event) => {
      void this.importSceneFile(event);
    });
    must<HTMLButtonElement>("export-scene").addEventListener("click", () => this.exportScene());

    const transformInputs = [
      "pos-x", "pos-y", "pos-z",
      "rot-x", "rot-y", "rot-z",
      "scale-x", "scale-y", "scale-z"
    ];

    for (const id of transformInputs) {
      must<HTMLInputElement>(id).addEventListener("change", () => {
        this.checkpoint();
        this.applyInspectorTransform();
      });
    }

    for (const id of ["size-x", "size-y", "size-z"]) {
      must<HTMLInputElement>(id).addEventListener("change", () => {
        this.checkpoint();
        this.applyInspectorSize();
      });
    }

    for (const id of ["env-sky", "env-ambient", "env-fog", "env-fog-density"]) {
      must<HTMLInputElement>(id).addEventListener("change", () => this.applyEnvironmentInputs());
    }

    must<HTMLInputElement>("prop-name").addEventListener("change", (event) => {
      if (!this.selectedId) return;
      const entity = this.forge.getEntity(this.selectedId);
      if (!entity) return;

      this.checkpoint();
      entity.name = (event.target as HTMLInputElement).value.trim() || entity.name;
      this.renderTree();
      this.renderInspector();
      this.log(`Renamed to ${entity.name}`);
    });

    window.addEventListener("pointerup", () => {
      if (this.mode === "editor" && this.selectedId) {
        this.forge.syncEntityFromMesh(this.selectedId);
        this.renderInspector();
      }
    });
  }

  private bindScenePicking(): void {
    this.forge.scene.onPointerObservable.add((pointerInfo) => {
      if (this.mode !== "editor" || pointerInfo.type !== PointerEventTypes.POINTERPICK) return;
      const picked = pointerInfo.pickInfo?.pickedMesh;
      const id = picked?.metadata?.forgeEntityId as string | undefined;
      if (id) this.selectEntity(id);
    });

    this.canvas.addEventListener("pointerdown", (event) => {
      if (this.mode === "editor" && event.button === 0 && this.selectedId) {
        this.checkpoint();
      }
    });
  }

  private bindKeyboard(): void {
    window.addEventListener("keydown", (event) => {
      if (
        event.target instanceof HTMLInputElement
        || event.target instanceof HTMLTextAreaElement
        || event.target instanceof HTMLSelectElement
      ) return;

      if (this.mode === "editor") {
        this.editorNavKeys.add(event.code);

        const control = event.ctrlKey || event.metaKey;
        if (control && event.code === "KeyZ" && event.shiftKey) {
          event.preventDefault();
          this.redo();
          return;
        }
        if (control && event.code === "KeyZ") {
          event.preventDefault();
          this.undo();
          return;
        }
        if (control && event.code === "KeyY") {
          event.preventDefault();
          this.redo();
          return;
        }
        if (control && event.code === "KeyD") {
          event.preventDefault();
          this.duplicateSelected();
          return;
        }

        if (control && event.code === "Digit1") {
          event.preventDefault();
          this.setTool("select");
          return;
        }
        if (control && event.code === "Digit2") {
          event.preventDefault();
          this.setTool("move");
          return;
        }
        if (control && event.code === "Digit3") {
          event.preventDefault();
          this.setTool("scale");
          return;
        }
        if (control && event.code === "Digit4") {
          event.preventDefault();
          this.setTool("rotate");
          return;
        }

        if (event.code === "Delete") {
          this.deleteSelected();
          return;
        }

        if (event.code === "KeyF" && this.selectedId) {
          this.focusSelected();
        }
      }
    });

    window.addEventListener("keyup", (event) => {
      this.editorNavKeys.delete(event.code);
    });

    window.addEventListener("blur", () => {
      this.editorNavKeys.clear();
      this.rightMouseNavigation = false;
      this.canvas.classList.remove("camera-orbiting");
    });
  }

  private bindEditorNavigation(): void {
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());

    this.canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 2 || this.mode !== "editor") return;

      event.preventDefault();
      this.rightMouseNavigation = true;
      this.editorOrbitLastX = event.clientX;
      this.editorOrbitLastY = event.clientY;
      this.canvas.setPointerCapture?.(event.pointerId);
      this.canvas.classList.add("camera-orbiting");
    });

    this.canvas.addEventListener("pointermove", (event) => {
      if (!this.rightMouseNavigation || this.mode !== "editor") return;

      const dx = event.clientX - this.editorOrbitLastX;
      const dy = event.clientY - this.editorOrbitLastY;
      this.editorOrbitLastX = event.clientX;
      this.editorOrbitLastY = event.clientY;

      this.editorCamera.alpha -= dx * 0.006;
      this.editorCamera.beta = Math.min(
        Math.PI - 0.18,
        Math.max(0.18, this.editorCamera.beta + dy * 0.006)
      );
    });

    this.canvas.addEventListener("wheel", (event) => {
      if (this.mode !== "editor") return;
      event.preventDefault();

      const nextRadius = this.editorCamera.radius + event.deltaY * 0.025;
      this.editorCamera.radius = Math.min(
        this.editorCamera.upperRadiusLimit ?? 120,
        Math.max(this.editorCamera.lowerRadiusLimit ?? 2, nextRadius)
      );
    }, { passive: false });

    window.addEventListener("pointerup", (event) => {
      if (event.button !== 2) return;
      this.rightMouseNavigation = false;
      this.canvas.classList.remove("camera-orbiting");
    });
  }

  private updateEditorCamera(dt: number): void {
    const forward = this.editorCamera.getForwardRay().direction.clone();
    forward.y = 0;
    if (forward.lengthSquared() < 0.0001) return;
    forward.normalize();

    const right = new Vector3(forward.z, 0, -forward.x);
    const move = Vector3.Zero();

    if (this.editorNavKeys.has("KeyW")) move.addInPlace(forward);
    if (this.editorNavKeys.has("KeyS")) move.subtractInPlace(forward);
    if (this.editorNavKeys.has("KeyD")) move.addInPlace(right);
    if (this.editorNavKeys.has("KeyA")) move.subtractInPlace(right);
    if (this.editorNavKeys.has("Space")) move.y += 1;
    if (this.editorNavKeys.has("ControlLeft") || this.editorNavKeys.has("ControlRight")) move.y -= 1;

    if (move.lengthSquared() === 0) return;

    move.normalize();
    const speed = this.editorNavKeys.has("ShiftLeft") || this.editorNavKeys.has("ShiftRight") ? 24 : 11;
    this.editorCamera.target.addInPlace(move.scale(speed * dt));
  }

  private setTool(tool: ToolMode): void {
    if (this.mode !== "editor") return;
    this.tool = tool;
    this.gizmos.positionGizmoEnabled = tool === "move";
    this.gizmos.rotationGizmoEnabled = tool === "rotate";
    this.gizmos.scaleGizmoEnabled = tool === "scale";
    if (this.gizmos.gizmos.positionGizmo) {
      this.gizmos.gizmos.positionGizmo.planarGizmoEnabled = false;
    }

    for (const name of ["select", "move", "rotate", "scale"] as const) {
      must<HTMLButtonElement>(`tool-${name}`).classList.toggle("active", name === tool);
    }

    this.applySnapSettings();
  }

  private applySnapSettings(): void {
    const moveDistance = this.snapEnabled ? this.moveSnap : 0;
    const rotationDistance = this.snapEnabled ? radians(15) : 0;
    const scaleDistance = this.snapEnabled ? 0.1 : 0;

    if (this.gizmos.gizmos.positionGizmo) {
      this.gizmos.gizmos.positionGizmo.snapDistance = moveDistance;
    }
    if (this.gizmos.gizmos.rotationGizmo) {
      this.gizmos.gizmos.rotationGizmo.snapDistance = rotationDistance;
    }
    if (this.gizmos.gizmos.scaleGizmo) {
      this.gizmos.gizmos.scaleGizmo.snapDistance = scaleDistance;
    }

    const toggle = must<HTMLButtonElement>("snap-toggle");
    toggle.classList.toggle("active", this.snapEnabled);
    toggle.textContent = this.snapEnabled ? "Snap On" : "Snap Off";
  }

  private createPrimitive(kind: ForgePrimitive): void {
    this.checkpoint();
    const entity = this.forge.createPrimitive(kind);
    this.renderTree();
    this.selectEntity(entity.id);
    this.log(`Created ${entity.name}`);
  }

  private createStudioObject(objectType: string): void {
    this.checkpoint();

    const names: Record<string, string> = {
      empty: "Object",
      light: "Point Light",
      sound: "Sound",
      "ui-text": "Screen Text",
      "ui-button": "UI Button",
      script: "Script",
      localscript: "LocalScript",
      modulescript: "ModuleScript"
    };

    const entity = this.forge.createPrimitive("empty", names[objectType] ?? "Object");
    entity.parentId = this.selectedId ?? undefined;
    entity.components = {};

    if (objectType === "light") {
      entity.components.Light = {
        type: "point",
        color: "#ffffff",
        intensity: 1.4,
        range: 24
      };
    } else if (objectType === "sound") {
      entity.components.Sound = {
        src: "",
        volume: 1,
        loop: false,
        autoplay: false,
        spatial: true,
        maxDistance: 40
      };
    } else if (objectType === "ui-text") {
      entity.components.UI = {
        type: "text",
        text: "Hello Forge",
        x: 0,
        y: 24,
        width: 320,
        height: 42,
        fontSize: 22,
        color: "#ffffff",
        background: "transparent",
        visible: true,
        anchor: "top-center"
      };
    } else if (objectType === "ui-button") {
      entity.components.UI = {
        type: "button",
        text: "Button",
        x: 0,
        y: 24,
        width: 180,
        height: 42,
        fontSize: 16,
        color: "#21303a",
        background: "#dce6ed",
        visible: true,
        anchor: "bottom-center"
      };
    } else if (["script", "localscript", "modulescript"].includes(objectType)) {
      const kind: ForgeScriptKind =
        objectType === "localscript" ? "LocalScript"
          : objectType === "modulescript" ? "ModuleScript"
          : "Script";

      entity.components.Script = {
        name: `custom.${entity.id}`,
        kind,
        enabled: true,
        source: this.defaultScriptSource(kind)
      };
    }

    const document = this.forge.exportDocument();
    this.setSelection(null);
    this.forge.loadDocument(document);
    this.forge.mountUI(this.uiRoot, false);
    this.renderTree();
    this.selectEntity(entity.id);
    this.log(`Inserted ${entity.name}${entity.parentId ? " as child object" : ""}.`);
  }

  private async importModelFile(event: Event): Promise<void> {
    if (this.mode !== "editor") return;

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      if (file.size > 8 * 1024 * 1024) {
        throw new Error("GLB is larger than 8 MB. Use a hosted model URL in the Model component for large assets.");
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error("Could not read model file."));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
      });

      this.checkpoint();
      const entity = this.forge.createPrimitive("model", file.name.replace(/\.glb$/i, "") || "Model");
      entity.parentId = this.selectedId ?? undefined;
      entity.components = {
        Model: {
          src: dataUrl,
          fileName: file.name
        },
        Collider: { enabled: false }
      };

      const document = this.forge.exportDocument();
      this.setSelection(null);
      this.forge.loadDocument(document);
      this.forge.mountUI(this.uiRoot, false);
      this.renderTree();
      this.selectEntity(entity.id);
      this.log(`Imported ${file.name}. Model loading in viewport...`);
    } catch (error) {
      this.log(`Model import failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      input.value = "";
    }
  }

  private createPrefab(prefab: ForgePrefabName): void {
    this.checkpoint();
    const entity = this.forge.createPrefab(prefab);
    this.renderTree();
    this.selectEntity(entity.id);
    this.log(`Created prefab: ${entity.name}`);
  }

  private duplicateSelected(): void {
    if (this.mode !== "editor" || !this.selectedId) return;

    this.forge.syncEntityFromMesh(this.selectedId);
    this.checkpoint();

    const copy = this.forge.duplicateEntity(this.selectedId);
    if (!copy) return;

    this.renderTree();
    this.selectEntity(copy.id);
    this.log(`Duplicated ${copy.name}`);
  }

  private deleteSelected(): void {
    if (this.mode !== "editor" || !this.selectedId) return;

    const entity = this.forge.getEntity(this.selectedId);
    if (!entity) return;

    this.checkpoint();
    this.setSelection(null);
    this.forge.deleteEntity(entity.id);
    this.renderTree();
    this.renderInspector();
    this.log(`Deleted ${entity.name}`);
  }

  private selectEntity(id: string): void {
    if (this.mode !== "editor") return;
    if (!this.forge.getMesh(id)) return;
    this.setSelection(id);
    this.renderTree();
    this.renderInspector();
  }

  private setSelection(id: string | null): void {
    if (this.selectedId) {
      const previous = this.forge.getMesh(this.selectedId);
      if (previous) previous.showBoundingBox = false;
    }

    this.selectedId = id;

    if (!id) {
      this.gizmos.attachToMesh(null);
      return;
    }

    const mesh = this.forge.getMesh(id);
    if (!mesh) {
      this.selectedId = null;
      this.gizmos.attachToMesh(null);
      return;
    }

    mesh.showBoundingBox = true;
    this.gizmos.attachToMesh(mesh);
  }

  private focusSelected(): void {
    if (!this.selectedId) return;
    const mesh = this.forge.getMesh(this.selectedId);
    if (!mesh) return;

    this.editorCamera.setTarget(mesh.getAbsolutePosition());
    this.editorCamera.radius = Math.max(4, mesh.getBoundingInfo().boundingSphere.radiusWorld * 5);
    this.log(`Focused ${this.forge.getEntity(this.selectedId)?.name ?? this.selectedId}`);
  }

  private renderTree(): void {
    this.tree.replaceChildren();

    const entities = this.forge.document.entities;
    const byParent = new Map<string | null, ForgeEntity[]>();

    for (const entity of entities) {
      const parentExists = entity.parentId && entities.some((candidate) => candidate.id === entity.parentId);
      const parentKey = parentExists ? entity.parentId! : null;
      const bucket = byParent.get(parentKey) ?? [];
      bucket.push(entity);
      byParent.set(parentKey, bucket);
    }

    const visited = new Set<string>();
    const appendEntity = (entity: ForgeEntity, depth: number) => {
      if (visited.has(entity.id)) return;
      visited.add(entity.id);

      const button = document.createElement("button");
      button.className = "scene-item";
      button.classList.toggle("selected", entity.id === this.selectedId);
      button.style.paddingLeft = `${8 + depth * 14}px`;

      const icon = entity.components?.Script ? "⌘"
        : entity.components?.Light ? "☀"
        : entity.components?.Sound ? "♪"
        : entity.components?.UI ? "▣"
        : entity.kind === "model" ? "⬡"
        : entity.kind === "empty" ? "◇"
        : "◆";

      button.textContent = `${icon} ${entity.name}`;
      button.title = entity.parentId
        ? `${entity.id} • child of ${entity.parentId}`
        : entity.id;
      button.addEventListener("click", () => this.selectEntity(entity.id));
      button.addEventListener("dblclick", () => {
        if (entity.components?.Script) this.openScriptEditor(entity.id);
      });
      this.tree.appendChild(button);

      for (const child of byParent.get(entity.id) ?? []) {
        appendEntity(child, depth + 1);
      }
    };

    for (const entity of byParent.get(null) ?? []) appendEntity(entity, 0);
    for (const entity of entities) {
      if (!visited.has(entity.id)) appendEntity(entity, 0);
    }
  }

  private renderInspector(): void {
    const entity = this.selectedId ? this.forge.getEntity(this.selectedId) : undefined;
    const mesh = this.selectedId ? this.forge.getMesh(this.selectedId) : undefined;

    this.inspectorEmpty.hidden = Boolean(entity && mesh);
    this.inspectorFields.hidden = !entity || !mesh;
    if (!entity || !mesh) return;

    must<HTMLInputElement>("prop-name").value = entity.name;
    must<HTMLInputElement>("pos-x").value = mesh.position.x.toFixed(2);
    must<HTMLInputElement>("pos-y").value = mesh.position.y.toFixed(2);
    must<HTMLInputElement>("pos-z").value = mesh.position.z.toFixed(2);
    must<HTMLInputElement>("rot-x").value = degrees(mesh.rotation.x).toFixed(1);
    must<HTMLInputElement>("rot-y").value = degrees(mesh.rotation.y).toFixed(1);
    must<HTMLInputElement>("rot-z").value = degrees(mesh.rotation.z).toFixed(1);
    const baseSize = entity.size ?? [1, 1, 1];
    must<HTMLInputElement>("size-x").value = Math.abs(baseSize[0] * mesh.scaling.x).toFixed(2);
    must<HTMLInputElement>("size-y").value = Math.abs(baseSize[1] * mesh.scaling.y).toFixed(2);
    must<HTMLInputElement>("size-z").value = Math.abs(baseSize[2] * mesh.scaling.z).toFixed(2);
    must<HTMLInputElement>("scale-x").value = mesh.scaling.x.toFixed(2);
    must<HTMLInputElement>("scale-y").value = mesh.scaling.y.toFixed(2);
    must<HTMLInputElement>("scale-z").value = mesh.scaling.z.toFixed(2);

    this.renderComponents(entity);
  }

  private addSelectedComponent(): void {
    if (this.mode !== "editor" || !this.selectedId) return;

    const entity = this.forge.getEntity(this.selectedId);
    if (!entity) return;

    const type = must<HTMLSelectElement>("component-type").value as keyof ForgeComponents;
    const components = entity.components ?? (entity.components = {});

    if (components[type] !== undefined) {
      this.log(`${type} already exists on ${entity.name}.`);
      return;
    }

    this.checkpoint();

    switch (type) {
      case "Collider":
        components.Collider = { enabled: true };
        break;
      case "Interactable":
        components.Interactable = { enabled: true, prompt: "E • Interact" };
        break;
      case "Door":
        components.Door = { openHeight: 4 };
        break;
      case "Clearance":
        components.Clearance = { level: 1 };
        break;
      case "PowerConsumer":
        components.PowerConsumer = { bus: "MAIN", draw: 1, required: true };
        break;
      case "Reactor":
        components.Reactor = { power: 0, temperature: 20 };
        break;
      case "Light":
        components.Light = { type: "point", color: "#ffffff", intensity: 1.2, range: 20 };
        break;
      case "Sound":
        components.Sound = { src: "", volume: 1, loop: false, autoplay: false, spatial: true, maxDistance: 40 };
        break;
      case "UI":
        components.UI = {
          type: "text", text: "Text", x: 16, y: 16, width: 220, height: 40,
          fontSize: 18, color: "#ffffff", background: "transparent", visible: true, anchor: "top-left"
        };
        break;
      case "Model":
        components.Model = { src: "" };
        break;
      case "Script":
        components.Script = {
          name: `custom.${entity.id}`,
          kind: "Script",
          enabled: true,
          source: this.defaultScriptSource("Script")
        };
        break;
    }

    this.renderInspector();
    this.log(`Added ${type} to ${entity.name}.`);
  }

  private renderComponents(entity: ForgeEntity): void {
    this.componentList.replaceChildren();

    const title = document.createElement("div");
    title.textContent = "Components";
    title.style.marginBottom = "7px";
    title.style.color = "#8f9ba5";
    this.componentList.appendChild(title);

    const components = entity.components ?? {};
    const names = Object.keys(components) as Array<keyof ForgeComponents>;

    if (names.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.style.padding = "6px 0";
      empty.textContent = "No gameplay components.";
      this.componentList.appendChild(empty);
      return;
    }

    for (const componentName of names) {
      const card = document.createElement("div");
      card.className = "component";

      const head = document.createElement("div");
      head.className = "component-head";

      const name = document.createElement("span");
      name.textContent = componentName;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => {
        this.checkpoint();
        if (entity.components) delete entity.components[componentName];
        this.forge.refreshUI();
        this.renderInspector();
        this.log(`Removed ${componentName} from ${entity.name}.`);
      });

      head.append(name, remove);
      card.appendChild(head);

      const fields = document.createElement("div");
      fields.className = "component-fields";
      this.renderComponentFields(entity, componentName, fields);
      card.appendChild(fields);

      this.componentList.appendChild(card);
    }
  }

  private renderComponentFields(
    entity: ForgeEntity,
    componentName: keyof ForgeComponents,
    container: HTMLDivElement
  ): void {
    const components = entity.components;
    if (!components) return;

    switch (componentName) {
      case "Collider": {
        const component = components.Collider;
        if (!component) return;
        this.appendCheckboxField(container, "Enabled", component.enabled, (value) => {
          component.enabled = value;
        });
        break;
      }
      case "Interactable": {
        const component = components.Interactable;
        if (!component) return;
        this.appendCheckboxField(container, "Enabled", component.enabled, (value) => {
          component.enabled = value;
        });
        this.appendTextField(container, "Prompt", component.prompt ?? "", (value) => {
          component.prompt = value;
        });
        break;
      }
      case "Door": {
        const component = components.Door;
        if (!component) return;
        this.appendNumberField(container, "Open height", component.openHeight ?? 4, 0.25, (value) => {
          component.openHeight = value;
        });
        break;
      }
      case "Clearance": {
        const component = components.Clearance;
        if (!component) return;
        this.appendNumberField(container, "Level", component.level, 1, (value) => {
          component.level = Math.max(0, Math.round(value));
        });
        break;
      }
      case "PowerConsumer": {
        const component = components.PowerConsumer;
        if (!component) return;
        this.appendTextField(container, "Power bus", component.bus, (value) => {
          component.bus = value || "MAIN";
        });
        this.appendNumberField(container, "Draw", component.draw ?? 0, 0.1, (value) => {
          component.draw = Math.max(0, value);
        });
        this.appendCheckboxField(container, "Power required", component.required ?? true, (value) => {
          component.required = value;
        });
        break;
      }
      case "Reactor": {
        const component = components.Reactor;
        if (!component) return;
        this.appendNumberField(container, "Power", component.power ?? 0, 0.01, (value) => {
          component.power = value;
        });
        this.appendNumberField(container, "Temperature", component.temperature ?? 20, 1, (value) => {
          component.temperature = value;
        });
        break;
      }
      case "Script": {
        const component = components.Script;
        if (!component) return;
        this.appendCheckboxField(container, "Enabled", component.enabled ?? true, (value) => {
          component.enabled = value;
        });
        this.appendTextField(container, "Script name", component.name, (value) => {
          component.name = value;
        });

        const open = document.createElement("button");
        open.type = "button";
        open.textContent = component.source?.trim() ? "Open Code" : "Override with Custom Code";
        open.addEventListener("click", () => this.openScriptEditor(entity.id));
        container.appendChild(open);
        break;
      }
    }
  }

  private defaultScriptSource(): string {
    return `let elapsed = 0;

Forge.onStart(() => {
  Forge.log(Forge.self.name + " started");
});

Forge.onUpdate((dt) => {
  elapsed += dt;
});

Forge.onInteract(() => {
  Forge.log("Interacted with " + Forge.self.name);
  // Example:
  // Forge.self.move(0, 1, 0);
});
`;
  }

  private openScriptEditor(entityId = this.selectedId): void {
    if (this.mode !== "editor") return;

    if (!entityId) {
      this.log("Select an object before opening Code.");
      return;
    }

    const entity = this.forge.getEntity(entityId);
    if (!entity) return;

    this.scriptEditingEntityId = entity.id;
    const script = entity.components?.Script;
    this.scriptTarget.textContent = entity.name;
    this.scriptName.value = script?.name || `custom.${entity.id}`;
    this.scriptSource.value = script?.source?.trim()
      ? script.source
      : this.defaultScriptSource();

    this.scriptDialog.showModal();
    requestAnimationFrame(() => this.scriptSource.focus());
  }

  private saveScriptEditor(): void {
    if (this.mode !== "editor" || !this.scriptEditingEntityId) return;

    const entity = this.forge.getEntity(this.scriptEditingEntityId);
    if (!entity) return;

    this.checkpoint();
    const components = entity.components ?? (entity.components = {});
    components.Script = {
      name: this.scriptName.value.trim() || `custom.${entity.id}`,
      enabled: true,
      source: this.scriptSource.value
    };

    this.renderInspector();
    this.log(`Saved script: ${components.Script.name} • press Play to run`);
  }

  private appendTextField(
    container: HTMLDivElement,
    labelText: string,
    value: string,
    apply: (value: string) => void
  ): void {
    const label = document.createElement("label");
    label.textContent = labelText;

    const input = document.createElement("input");
    input.type = "text";
    input.value = value;
    input.addEventListener("change", () => {
      this.checkpoint();
      apply(input.value.trim());
      this.renderInspector();
      this.log(`${labelText} updated.`);
    });

    label.appendChild(input);
    container.appendChild(label);
  }

  private appendNumberField(
    container: HTMLDivElement,
    labelText: string,
    value: number,
    step: number,
    apply: (value: number) => void
  ): void {
    const label = document.createElement("label");
    label.textContent = labelText;

    const input = document.createElement("input");
    input.type = "number";
    input.step = String(step);
    input.value = String(value);
    input.addEventListener("change", () => {
      const next = Number(input.value);
      if (!Number.isFinite(next)) {
        input.value = String(value);
        return;
      }
      this.checkpoint();
      apply(next);
      this.renderInspector();
      this.log(`${labelText} updated.`);
    });

    label.appendChild(input);
    container.appendChild(label);
  }

  private appendCheckboxField(
    container: HTMLDivElement,
    labelText: string,
    value: boolean,
    apply: (value: boolean) => void
  ): void {
    const label = document.createElement("label");
    label.textContent = labelText;

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = value;
    input.addEventListener("change", () => {
      this.checkpoint();
      apply(input.checked);
      this.renderInspector();
      this.log(`${labelText} updated.`);
    });

    label.appendChild(input);
    container.appendChild(label);
  }

  private applyInspectorTransform(): void {
    if (!this.selectedId) return;
    const mesh = this.forge.getMesh(this.selectedId);
    if (!mesh) return;

    mesh.position.set(
      Number(must<HTMLInputElement>("pos-x").value),
      Number(must<HTMLInputElement>("pos-y").value),
      Number(must<HTMLInputElement>("pos-z").value)
    );
    mesh.rotation.set(
      radians(Number(must<HTMLInputElement>("rot-x").value)),
      radians(Number(must<HTMLInputElement>("rot-y").value)),
      radians(Number(must<HTMLInputElement>("rot-z").value))
    );
    mesh.scaling.set(
      Number(must<HTMLInputElement>("scale-x").value),
      Number(must<HTMLInputElement>("scale-y").value),
      Number(must<HTMLInputElement>("scale-z").value)
    );

    this.forge.syncEntityFromMesh(this.selectedId);
    this.renderInspector();
    this.log("Transform updated.");
  }

  private checkpoint(): void {
    if (this.mode !== "editor") return;
    const snapshot = this.forge.exportDocument();
    this.history.checkpoint(snapshot);
    this.updateHistoryUI();
  }

  private undo(): void {
    if (this.mode !== "editor") return;
    const current = this.forge.exportDocument();
    const previous = this.history.undo(current);
    if (!previous) {
      this.log("Nothing to undo.");
      return;
    }

    this.restoreDocument(previous, "Undo");
  }

  private redo(): void {
    if (this.mode !== "editor") return;
    const current = this.forge.exportDocument();
    const next = this.history.redo(current);
    if (!next) {
      this.log("Nothing to redo.");
      return;
    }

    this.restoreDocument(next, "Redo");
  }

  private restoreDocument(sceneDocument: ForgeSceneDocument, action: string): void {
    const wantedSelection = this.selectedId;
    this.setSelection(null);
    this.forge.loadDocument(sceneDocument);

    if (wantedSelection && this.forge.getEntity(wantedSelection)) {
      this.setSelection(wantedSelection);
    }

    this.renderTree();
    this.renderInspector();
    this.updateHistoryUI();
    this.log(`${action} complete.`);
  }

  private updateHistoryUI(): void {
    const undoButton = must<HTMLButtonElement>("undo");
    const redoButton = must<HTMLButtonElement>("redo");
    undoButton.disabled = this.mode !== "editor" || !this.history.canUndo;
    redoButton.disabled = this.mode !== "editor" || !this.history.canRedo;
    this.historyState.textContent = `Undo ${this.history.undoCount} • Redo ${this.history.redoCount}`;
  }

  private enterPlayMode(): void {
    if (this.mode === "play") return;
    delete this.canvas.dataset.runtimeError;

    this.playSnapshot = this.forge.exportDocument();
    this.setSelection(null);
    this.forge.loadDocument(this.playSnapshot);
    this.mode = "play";
    this.gizmos.positionGizmoEnabled = false;
    this.gizmos.rotationGizmoEnabled = false;
    this.gizmos.scaleGizmoEnabled = false;
    this.editorCamera.detachControl();
    this.editorNavKeys.clear();
    this.rightMouseNavigation = false;

    const spawn = this.forge.document.playerSpawn ?? [0, 2.2, 20];
    this.player = new PlayerController(
      this.forge,
      spawn,
      (message) => this.log(message),
      (text, locked) => this.setInteractionPrompt(text, locked)
    );

    must<HTMLButtonElement>("play").disabled = true;
    must<HTMLButtonElement>("stop").disabled = false;
    this.modeBadge.textContent = "PLAY";
    this.modeBadge.classList.add("playing");
    this.renderTree();
    this.renderInspector();
    this.updateHistoryUI();
  }

  private exitPlayMode(): void {
    if (this.mode !== "play") return;

    this.player?.dispose();
    this.player = null;
    this.mode = "editor";

    if (this.playSnapshot) {
      this.forge.loadDocument(this.playSnapshot);
      this.playSnapshot = null;
    }

    this.forge.scene.activeCamera = this.editorCamera;
    this.setTool(this.tool);

    must<HTMLButtonElement>("play").disabled = false;
    must<HTMLButtonElement>("stop").disabled = true;
    this.modeBadge.textContent = "EDITOR";
    this.modeBadge.classList.remove("playing");
    this.setInteractionPrompt(null, false);
    this.renderTree();
    this.renderInspector();
    this.updateHistoryUI();
    this.log("Returned to editor. Runtime changes reverted.");
  }

  private saveLocal(): void {
    if (this.mode !== "editor") return;
    const sceneDocument = this.forge.exportDocument();
    localStorage.setItem("forge:last-scene", JSON.stringify(sceneDocument));
    window.dispatchEvent(new CustomEvent("forge:scene-saved", { detail: structuredClone(sceneDocument) }));
    this.log(`Saved ${sceneDocument.name} in this browser.`);
  }

  private loadLocal(): void {
    if (this.mode !== "editor") return;

    const raw = localStorage.getItem("forge:last-scene");
    if (!raw) {
      this.log("No browser save found.");
      return;
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!this.isForgeSceneDocument(parsed)) {
        throw new Error("Saved data is not a valid Forge scene.");
      }
      this.loadSceneDocument(parsed, "Loaded browser save.");
    } catch (error) {
      this.log(`Load failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async importSceneFile(event: Event): Promise<void> {
    if (this.mode !== "editor") return;

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!this.isForgeSceneDocument(parsed)) {
        throw new Error("File is not a Forge scene v1.");
      }
      this.loadSceneDocument(parsed, `Imported ${file.name}.`);
    } catch (error) {
      this.log(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      input.value = "";
    }
  }

  private loadSceneDocument(sceneDocument: ForgeSceneDocument, message: string): void {
    this.checkpoint();
    this.setSelection(null);
    this.forge.loadDocument(sceneDocument);
    this.renderTree();
    this.renderInspector();
    this.updateHistoryUI();
    this.log(message);
  }

  private isForgeSceneDocument(value: unknown): value is ForgeSceneDocument {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<ForgeSceneDocument>;
    return candidate.format === "forge.scene"
      && candidate.version === 1
      && typeof candidate.name === "string"
      && Array.isArray(candidate.entities);
  }

  private exportScene(): void {
    const sceneDocument = this.forge.exportDocument();
    const blob = new Blob([JSON.stringify(sceneDocument, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `${this.forge.document.name.toLowerCase().replaceAll(" ", "-")}.forge.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    this.log("Scene exported.");
  }

  private setInteractionPrompt(text: string | null, locked: boolean): void {
    this.interactionPrompt.hidden = !text;
    this.interactionPrompt.textContent = text ?? "";
    this.interactionPrompt.classList.toggle("locked", locked);
  }

  private log(message: string): void {
    this.status.textContent = message;
  }
}
