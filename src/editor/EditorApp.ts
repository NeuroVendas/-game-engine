import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { GizmoManager } from "@babylonjs/core/Gizmos/gizmoManager";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { ForgeComponents, ForgeEntity, ForgePrefabDocument, ForgePrimitive, ForgeSceneDocument, ForgeScriptKind } from "../types";
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
  private draggedEntityId: string | null = null;
  private transformSpace: "world" | "local" = "world";
  private snapEnabled = true;
  private collisionDebug = false;
  private moveSnap = 1;
  private rotationSnap = 15;
  private scaleSnap = 0.1;

  private readonly tree = must<HTMLDivElement>("scene-tree");
  private readonly status = must<HTMLSpanElement>("status");
  private readonly outputLog = must<HTMLDivElement>("output-log");
  private readonly fps = must<HTMLDivElement>("fps");
  private readonly historyState = must<HTMLDivElement>("history-state");
  private readonly modeBadge = must<HTMLDivElement>("mode-badge");
  private readonly interactionPrompt = must<HTMLDivElement>("interaction-prompt");
  private readonly uiRoot = must<HTMLDivElement>("forge-ui-root");
  private readonly inspectorEmpty = must<HTMLDivElement>("inspector-empty");
  private readonly inspectorFields = must<HTMLDivElement>("inspector-fields");
  private readonly componentList = must<HTMLDivElement>("component-list");
  private readonly projectPrefabList = must<HTMLDivElement>("project-prefab-list");
  private readonly scriptDialog = must<HTMLDialogElement>("script-editor-dialog");
  private readonly scriptTarget = must<HTMLSpanElement>("script-editor-target");
  private readonly scriptKind = must<HTMLSelectElement>("script-kind");
  private readonly scriptName = must<HTMLInputElement>("script-name");
  private readonly scriptSource = must<HTMLTextAreaElement>("script-source");
  private scriptEditingEntityId: string | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.forge = new ForgeEngine(canvas, (message) => this.log(message));
    registerDefaultScripts(this.forge.scripts);

    this.canvas.addEventListener("forge:model-loaded", ((event: Event) => {
      const detail = (event as CustomEvent<{ entityId?: string }>).detail;
      if (this.mode === "editor" && detail?.entityId === this.selectedId) {
        this.renderInspector();
      }
    }) as EventListener);

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

    this.bindGizmoTransactions();
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
    this.renderProjectPrefabs();
    this.syncEnvironmentInputs();
    this.syncPlayerInputs();
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
    this.renderProjectPrefabs();
    this.syncEnvironmentInputs();
    this.syncPlayerInputs();
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
          if (this.player) this.forge.updateTriggers(this.player.body);
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

    must<HTMLButtonElement>("transform-space").addEventListener("click", () => this.toggleTransformSpace());

    must<HTMLButtonElement>("snap-toggle").addEventListener("click", () => {
      this.snapEnabled = !this.snapEnabled;
      this.applySnapSettings();
      this.log(
        this.snapEnabled
          ? `Snap enabled • move ${this.moveSnap}u • rotate ${this.rotationSnap}° • resize ${this.scaleSnap}.`
          : "Snap disabled."
      );
    });

    must<HTMLSelectElement>("snap-size").addEventListener("change", (event) => {
      const next = Number((event.target as HTMLSelectElement).value);
      if (Number.isFinite(next) && next > 0) {
        this.moveSnap = next;
        this.applySnapSettings();
        this.log(`Move snap: ${this.moveSnap}u.`);
      }
    });

    must<HTMLSelectElement>("rotation-snap").addEventListener("change", (event) => {
      const next = Number((event.target as HTMLSelectElement).value);
      if (Number.isFinite(next) && next > 0) {
        this.rotationSnap = next;
        this.applySnapSettings();
        this.log(`Rotation snap: ${this.rotationSnap}°.`);
      }
    });

    must<HTMLSelectElement>("scale-snap").addEventListener("change", (event) => {
      const next = Number((event.target as HTMLSelectElement).value);
      if (Number.isFinite(next) && next > 0) {
        this.scaleSnap = next;
        this.applySnapSettings();
        this.log(`Resize snap: ${this.scaleSnap}.`);
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
    must<HTMLButtonElement>("import-texture").addEventListener("click", () => {
      must<HTMLInputElement>("texture-file-input").click();
    });
    must<HTMLInputElement>("texture-file-input").addEventListener("change", (event) => {
      void this.importTextureFile(event);
    });
    must<HTMLButtonElement>("import-audio").addEventListener("click", () => {
      must<HTMLInputElement>("audio-file-input").click();
    });
    must<HTMLButtonElement>("import-sky").addEventListener("click", () => {
      must<HTMLInputElement>("sky-file-input").click();
    });
    must<HTMLInputElement>("sky-file-input").addEventListener("change", (event) => {
      void this.importSkyFile(event);
    });
    must<HTMLButtonElement>("clear-sky").addEventListener("click", () => {
      if (!this.forge.document.environment) this.forge.document.environment = {};
      this.checkpoint();
      this.forge.document.environment.skyTexture = undefined;
      this.forge.document.environment.skyTextureFileName = undefined;
      this.forge.applyEnvironment(this.forge.document.environment);
      this.syncEnvironmentInputs();
      this.log("Sky image cleared. Using color sky.");
    });
    must<HTMLInputElement>("audio-file-input").addEventListener("change", (event) => {
      void this.importAudioFile(event);
    });

    document.querySelectorAll<HTMLButtonElement>("[data-prefab]").forEach((button) => {
      button.addEventListener("click", () => {
        if (this.mode !== "editor") return;
        const prefab = button.dataset.prefab as ForgePrefabName | undefined;
        if (!prefab) return;
        this.createPrefab(prefab);
      });
    });

    must<HTMLButtonElement>("save-project-prefab").addEventListener("click", () => {
      this.saveSelectionToProjectPrefabs();
    });

    must<HTMLButtonElement>("duplicate-selected").addEventListener("click", () => this.duplicateSelected());
    must<HTMLButtonElement>("delete-selected").addEventListener("click", () => this.deleteSelected());
    must<HTMLButtonElement>("code-selected").addEventListener("click", () => this.openScriptEditor());
    must<HTMLButtonElement>("collision-debug").addEventListener("click", () => this.toggleCollisionDebug());
    must<HTMLButtonElement>("add-component").addEventListener("click", () => this.addSelectedComponent());
    must<HTMLButtonElement>("script-close").addEventListener("click", () => this.scriptDialog.close());
    must<HTMLButtonElement>("script-save").addEventListener("click", () => this.saveScriptEditor());
    must<HTMLButtonElement>("script-check").addEventListener("click", () => this.checkScriptSyntax());
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
    must<HTMLButtonElement>("export-prefab").addEventListener("click", () => this.exportSelectedPrefab());
    must<HTMLButtonElement>("import-prefab").addEventListener("click", () => {
      must<HTMLInputElement>("prefab-file-input").click();
    });
    must<HTMLInputElement>("prefab-file-input").addEventListener("change", (event) => {
      void this.importPrefabFile(event);
    });

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

    for (const id of [
      "player-collider-height",
      "player-collider-radius",
      "player-walk-speed",
      "player-run-speed",
      "player-jump-power",
      "player-max-health"
    ]) {
      must<HTMLInputElement>(id).addEventListener("change", () => this.applyPlayerInputs());
    }
    must<HTMLInputElement>("player-auto-respawn").addEventListener("change", () => this.applyPlayerInputs());

    document.querySelectorAll<HTMLButtonElement>("[data-environment-preset]").forEach((button) => {
      button.addEventListener("click", () => {
        const preset = button.dataset.environmentPreset;
        if (preset) this.applyEnvironmentPreset(preset);
      });
    });

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

    must<HTMLSelectElement>("prop-parent").addEventListener("change", () => this.applyParentSelection());
    must<HTMLInputElement>("prop-texture").addEventListener("change", () => this.applyAppearance());
    must<HTMLButtonElement>("clear-texture").addEventListener("click", () => {
      if (!this.selectedId) return;
      must<HTMLInputElement>("prop-texture").value = "";
      this.applyAppearance();
    });

    for (const id of ["prop-color", "prop-emissive", "prop-transparency"]) {
      must<HTMLInputElement>(id).addEventListener("change", () => this.applyAppearance());
    }
    must<HTMLSelectElement>("prop-material").addEventListener("change", () => this.applyAppearance());

    const workspaceRoot = must<HTMLDivElement>("workspace-root");
    workspaceRoot.addEventListener("dragover", (event) => {
      const draggedId = event.dataTransfer?.getData("application/x-forge-entity")
        || event.dataTransfer?.getData("text/plain")
        || this.draggedEntityId;
      if (!draggedId) return;
      event.preventDefault();
      workspaceRoot.classList.add("drop-target");
    });
    workspaceRoot.addEventListener("dragleave", () => workspaceRoot.classList.remove("drop-target"));
    workspaceRoot.addEventListener("drop", (event) => {
      event.preventDefault();
      workspaceRoot.classList.remove("drop-target");
      const draggedId = event.dataTransfer?.getData("application/x-forge-entity")
        || event.dataTransfer?.getData("text/plain")
        || this.draggedEntityId;
      if (draggedId) this.reparentEntity(draggedId);
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
        if (control && event.code === "Digit5") {
          event.preventDefault();
          this.toggleTransformSpace();
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
    this.canvas.dataset.editorTool = tool;
    this.gizmos.positionGizmoEnabled = tool === "move";
    this.gizmos.rotationGizmoEnabled = tool === "rotate";
    this.gizmos.scaleGizmoEnabled = tool === "scale";
    if (this.gizmos.gizmos.positionGizmo) {
      this.gizmos.gizmos.positionGizmo.planarGizmoEnabled = false;
    }

    this.applyTransformSpace();

    for (const name of ["select", "move", "rotate", "scale"] as const) {
      must<HTMLButtonElement>(`tool-${name}`).classList.toggle("active", name === tool);
    }

    this.applySnapSettings();
  }

  private applySnapSettings(): void {
    const moveDistance = this.snapEnabled ? this.moveSnap : 0;
    const rotationDistance = this.snapEnabled ? radians(this.rotationSnap) : 0;
    const scaleDistance = this.snapEnabled ? this.scaleSnap : 0;

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

  private toggleTransformSpace(): void {
    if (this.mode !== "editor") return;
    this.transformSpace = this.transformSpace === "world" ? "local" : "world";
    this.applyTransformSpace();
    this.log(`Transform space: ${this.transformSpace === "world" ? "World" : "Local"}.`);
  }

  private applyTransformSpace(): void {
    const local = this.transformSpace === "local";
    this.canvas.dataset.editorSpace = this.transformSpace;

    if (this.gizmos.gizmos.positionGizmo) {
      this.gizmos.gizmos.positionGizmo.updateGizmoRotationToMatchAttachedMesh = local;
    }
    if (this.gizmos.gizmos.rotationGizmo) {
      this.gizmos.gizmos.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = local;
    }
    if (this.gizmos.gizmos.scaleGizmo) {
      this.gizmos.gizmos.scaleGizmo.updateGizmoRotationToMatchAttachedMesh = local;
    }

    const button = must<HTMLButtonElement>("transform-space");
    button.classList.toggle("active", local);
    button.textContent = local ? "Local" : "World";
    button.title = local
      ? "Transforms follow the selected object's axes (Ctrl+5)"
      : "Transforms follow world axes (Ctrl+5)";
  }

  private bindGizmoTransactions(): void {
    const begin = () => {
      if (this.mode !== "editor" || !this.selectedId) return;
      this.checkpoint();
    };

    const finish = () => {
      if (this.mode !== "editor" || !this.selectedId) return;

      this.forge.syncEntityFromMesh(this.selectedId);
      if (this.tool === "scale") this.bakeSelectedResize();
      this.renderInspector();
      this.renderTree();
    };

    const bind = (gizmo: any) => {
      if (!gizmo?.dragBehavior) return;
      gizmo.dragBehavior.onDragStartObservable.add(begin);
      gizmo.dragBehavior.onDragEndObservable.add(finish);
    };

    const position = this.gizmos.gizmos.positionGizmo;
    bind(position?.xGizmo);
    bind(position?.yGizmo);
    bind(position?.zGizmo);

    const rotation = this.gizmos.gizmos.rotationGizmo;
    bind(rotation?.xGizmo);
    bind(rotation?.yGizmo);
    bind(rotation?.zGizmo);

    const scale = this.gizmos.gizmos.scaleGizmo;
    bind(scale?.xGizmo);
    bind(scale?.yGizmo);
    bind(scale?.zGizmo);
    bind(scale?.uniformScaleGizmo);
  }

  private bakeSelectedResize(): void {
    if (!this.selectedId) return;

    const entity = this.forge.getEntity(this.selectedId);
    const mesh = this.forge.getMesh(this.selectedId);
    if (!entity || !mesh) return;

    // Models and groups intentionally retain transform scale. Primitive Resize
    // behaves like a size-editing tool instead of accumulating arbitrary scale.
    if (entity.kind === "model" || entity.kind === "empty") return;

    const sx = Math.abs(mesh.scaling.x);
    const sy = Math.abs(mesh.scaling.y);
    const sz = Math.abs(mesh.scaling.z);
    if (
      Math.abs(sx - 1) < 0.0001
      && Math.abs(sy - 1) < 0.0001
      && Math.abs(sz - 1) < 0.0001
    ) return;

    const base = entity.size ?? [1, 1, 1];
    entity.size = [
      Math.max(0.05, base[0] * sx),
      Math.max(0.05, base[1] * sy),
      Math.max(0.05, base[2] * sz)
    ];
    entity.scale = [1, 1, 1];

    this.forge.rebuildEntity(entity.id);
    this.setSelection(entity.id);
    this.canvas.dataset.lastResize = entity.size.map((value) => value.toFixed(3)).join(",");
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
      group: "Group",
      light: "Point Light",
      sound: "Sound",
      vfx: "Particle VFX",
      "ui-text": "Screen Text",
      "ui-button": "UI Button",
      script: "Script",
      localscript: "LocalScript",
      modulescript: "ModuleScript",
      spawn: "Spawn Location"
    };

    const entity = this.forge.createPrimitive(
      objectType === "spawn" ? "cylinder" : "empty",
      names[objectType] ?? "Object"
    );
    entity.parentId = this.selectedId ?? undefined;
    entity.components = {};

    if (objectType === "spawn") {
      entity.size = [4, 0.18, 4];
      entity.position = [0, 0.1, 0];
      entity.color = "#77b75a";
      entity.emissive = "#233f19";
      entity.transparency = 0.2;
      entity.components.Spawn = { enabled: true };
      entity.components.Collider = { enabled: false };
    } else if (objectType === "light") {
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
    } else if (objectType === "vfx") {
      entity.components.Particle = {
        enabled: true,
        preset: "energy",
        color: "#b7f34a",
        color2: "#5ed0ff",
        emitRate: 55,
        capacity: 400,
        lifetime: 1.1,
        size: 0.28,
        speed: 1.8,
        autoplay: true
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
          fileName: file.name,
          animationAutoplay: false,
          animationLoop: true,
          animationSpeed: 1
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

  private async importTextureFile(event: Event): Promise<void> {
    if (this.mode !== "editor") return;

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      if (!this.selectedId) {
        throw new Error("Select a visible object before importing a texture.");
      }
      if (file.size > 4 * 1024 * 1024) {
        throw new Error("Texture is larger than 4 MB. Use a hosted texture URL for larger images.");
      }

      const entity = this.forge.getEntity(this.selectedId);
      if (!entity || entity.kind === "empty" || entity.kind === "model") {
        throw new Error("Textures can be applied to Forge primitive objects.");
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error("Could not read texture file."));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
      });

      this.checkpoint();
      entity.texture = dataUrl;
      entity.textureFileName = file.name;
      this.forge.rebuildEntity(entity.id);
      this.setSelection(entity.id);
      this.renderInspector();
      this.log(`Applied texture ${file.name} to ${entity.name}.`);
    } catch (error) {
      this.log(`Texture import failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      input.value = "";
    }
  }

  private async importSkyFile(event: Event): Promise<void> {
    if (this.mode !== "editor") return;

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      if (file.size > 6 * 1024 * 1024) {
        throw new Error("Sky image is larger than 6 MB. Use a smaller JPG/WebP image.");
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error("Could not read sky image."));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
      });

      this.checkpoint();
      const environment = this.forge.document.environment ?? (this.forge.document.environment = {});
      environment.skyTexture = dataUrl;
      environment.skyTextureFileName = file.name;
      this.forge.applyEnvironment(environment);
      this.syncEnvironmentInputs();
      this.log(`Sky image applied: ${file.name}`);
    } catch (error) {
      this.log(`Sky import failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      input.value = "";
    }
  }

  private async importAudioFile(event: Event): Promise<void> {
    if (this.mode !== "editor") return;

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("Audio is larger than 5 MB. Use a hosted audio URL for larger assets.");
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error("Could not read audio file."));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
      });

      this.checkpoint();
      const entity = this.forge.createPrimitive("empty", file.name.replace(/\.[^.]+$/, "") || "Sound");
      entity.parentId = this.selectedId ?? undefined;
      entity.components = {
        Sound: {
          src: dataUrl,
          fileName: file.name,
          volume: 1,
          loop: false,
          autoplay: false,
          spatial: true,
          maxDistance: 40
        }
      };

      const document = this.forge.exportDocument();
      this.setSelection(null);
      this.forge.loadDocument(document, false);
      this.forge.mountUI(this.uiRoot, false);
      this.renderTree();
      this.selectEntity(entity.id);
      this.log(`Imported audio ${file.name}. Enable Autoplay or trigger it from gameplay later.`);
    } catch (error) {
      this.log(`Audio import failed: ${error instanceof Error ? error.message : String(error)}`);
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

  private createProjectPrefabDocument(rootId: string, name: string): ForgePrefabDocument | null {
    const subtree = this.collectEntitySubtree(rootId);
    if (subtree.length === 0) return null;

    for (const entity of subtree) this.forge.syncEntityFromMesh(entity.id);

    const entities = structuredClone(subtree);
    const root = entities[0];
    root.parentId = undefined;
    root.position = [0, 0, 0];

    return {
      format: "forge.prefab",
      version: 1,
      name,
      entities
    };
  }

  private saveSelectionToProjectPrefabs(): void {
    if (this.mode !== "editor" || !this.selectedId) {
      this.log("Select an object or group before saving a project prefab.");
      return;
    }

    const selected = this.forge.getEntity(this.selectedId);
    if (!selected) return;

    const library = this.forge.document.prefabs ?? (this.forge.document.prefabs = []);
    const baseName = selected.name.trim() || "Prefab";
    let name = baseName;
    let index = 2;
    const existing = new Set(library.map((prefab) => prefab.name.toLowerCase()));
    while (existing.has(name.toLowerCase())) {
      name = `${baseName} ${index}`;
      index += 1;
    }

    const prefab = this.createProjectPrefabDocument(selected.id, name);
    if (!prefab) return;

    this.checkpoint();
    library.push(prefab);
    this.renderProjectPrefabs();
    this.log(`Saved project prefab: ${name} • ${prefab.entities.length} object(s).`);
  }

  private insertProjectPrefab(index: number): void {
    if (this.mode !== "editor") return;
    const prefab = this.forge.document.prefabs?.[index];
    if (!prefab) return;

    this.checkpoint();
    const root = this.forge.instantiatePrefab(prefab.entities, this.selectedId ?? undefined);
    if (!root) {
      this.log(`Could not insert project prefab: ${prefab.name}.`);
      return;
    }

    this.renderTree();
    this.selectEntity(root.id);
    this.renderProjectPrefabs();
    this.log(`Inserted project prefab: ${prefab.name}.`);
  }

  private deleteProjectPrefab(index: number): void {
    if (this.mode !== "editor") return;
    const library = this.forge.document.prefabs;
    const prefab = library?.[index];
    if (!library || !prefab) return;

    this.checkpoint();
    library.splice(index, 1);
    this.renderProjectPrefabs();
    this.log(`Deleted project prefab: ${prefab.name}.`);
  }

  private renderProjectPrefabs(): void {
    this.projectPrefabList.replaceChildren();
    const library = this.forge.document.prefabs ?? [];
    const editable = this.mode === "editor";
    const save = must<HTMLButtonElement>("save-project-prefab");
    save.disabled = !editable || !this.selectedId;

    this.canvas.dataset.projectPrefabCount = String(library.length);

    if (library.length === 0) {
      const empty = document.createElement("div");
      empty.className = "component-note";
      empty.textContent = "No saved prefabs.";
      this.projectPrefabList.appendChild(empty);
      return;
    }

    library.forEach((prefab, index) => {
      const row = document.createElement("div");
      row.className = "project-prefab-row";
      row.dataset.projectPrefabName = prefab.name;

      const insert = document.createElement("button");
      insert.type = "button";
      insert.dataset.projectPrefabInsert = prefab.name;
      insert.textContent = `▧ ${prefab.name}`;
      insert.title = `Insert ${prefab.name}`;
      insert.disabled = !editable;
      insert.addEventListener("click", () => this.insertProjectPrefab(index));

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "project-prefab-delete";
      remove.dataset.projectPrefabDelete = prefab.name;
      remove.textContent = "×";
      remove.title = `Delete ${prefab.name}`;
      remove.disabled = !editable;
      remove.addEventListener("click", () => this.deleteProjectPrefab(index));

      row.append(insert, remove);
      this.projectPrefabList.appendChild(row);
    });
  }

  private toggleCollisionDebug(): void {
    if (this.mode !== "editor") return;
    this.collisionDebug = !this.collisionDebug;
    this.forge.setCollisionDebug(this.collisionDebug);

    const button = must<HTMLButtonElement>("collision-debug");
    button.classList.toggle("active", this.collisionDebug);
    button.textContent = this.collisionDebug ? "Colliders On" : "Colliders Off";
    this.log(this.collisionDebug
      ? "Collider visualization enabled."
      : "Collider visualization disabled.");
  }

  private collectEntitySubtree(rootId: string): ForgeEntity[] {
    const result: ForgeEntity[] = [];
    const visit = (id: string) => {
      const entity = this.forge.getEntity(id);
      if (!entity) return;
      result.push(entity);
      for (const child of this.forge.document.entities.filter((candidate) => candidate.parentId === id)) {
        visit(child.id);
      }
    };
    visit(rootId);
    return result;
  }

  private exportSelectedPrefab(): void {
    if (this.mode !== "editor" || !this.selectedId) {
      this.log("Select an object or group before exporting a prefab.");
      return;
    }

    const subtree = this.collectEntitySubtree(this.selectedId);
    if (subtree.length === 0) return;

    for (const entity of subtree) this.forge.syncEntityFromMesh(entity.id);

    const entities = structuredClone(subtree);
    const root = entities[0];
    root.parentId = undefined;
    root.position = [0, 0, 0];

    const prefab: ForgePrefabDocument = {
      format: "forge.prefab",
      version: 1,
      name: root.name,
      entities
    };

    const blob = new Blob([JSON.stringify(prefab, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `${root.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "prefab"}.forge-prefab.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    this.log(`Prefab exported: ${root.name} • ${entities.length} object(s).`);
  }

  private async importPrefabFile(event: Event): Promise<void> {
    if (this.mode !== "editor") return;

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!this.isForgePrefabDocument(parsed)) {
        throw new Error("File is not a Forge prefab v1.");
      }

      this.checkpoint();
      const root = this.forge.instantiatePrefab(parsed.entities, this.selectedId ?? undefined);
      if (!root) throw new Error("Prefab does not contain any objects.");

      this.renderTree();
      this.selectEntity(root.id);
      this.log(`Prefab imported: ${parsed.name} • ${parsed.entities.length} object(s).`);
    } catch (error) {
      this.log(`Prefab import failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      input.value = "";
    }
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
    this.renderProjectPrefabs();

    if (!id) {
      this.gizmos.attachToMesh(null);
      return;
    }

    const mesh = this.forge.getMesh(id);
    if (!mesh) {
      this.selectedId = null;
      this.renderProjectPrefabs();
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
      button.dataset.entityId = entity.id;
      button.draggable = true;
      button.title = entity.parentId
        ? `${entity.id} • child of ${entity.parentId}`
        : entity.id;
      button.addEventListener("click", () => this.selectEntity(entity.id));
      button.addEventListener("dblclick", () => {
        if (entity.components?.Script) this.openScriptEditor(entity.id);
      });
      button.addEventListener("dragstart", (event) => {
        this.draggedEntityId = entity.id;
        event.dataTransfer?.setData("application/x-forge-entity", entity.id);
        event.dataTransfer?.setData("text/plain", entity.id);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
        button.classList.add("dragging");
      });
      button.addEventListener("dragend", () => {
        this.draggedEntityId = null;
        button.classList.remove("dragging");
      });
      button.addEventListener("dragover", (event) => {
        const draggedId = event.dataTransfer?.getData("application/x-forge-entity")
          || event.dataTransfer?.getData("text/plain")
          || this.draggedEntityId;
        if (!draggedId || draggedId === entity.id || this.wouldCreateParentCycle(draggedId, entity.id)) return;
        event.preventDefault();
        button.classList.add("drop-target");
      });
      button.addEventListener("dragleave", () => button.classList.remove("drop-target"));
      button.addEventListener("drop", (event) => {
        event.preventDefault();
        button.classList.remove("drop-target");
        const draggedId = event.dataTransfer?.getData("application/x-forge-entity")
          || event.dataTransfer?.getData("text/plain")
          || this.draggedEntityId;
        if (!draggedId || draggedId === entity.id) return;
        this.reparentEntity(draggedId, entity.id);
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
    this.renderParentOptions(entity);
    must<HTMLInputElement>("prop-color").value = this.safeHex(entity.color, "#8796a3");
    must<HTMLSelectElement>("prop-material").value = entity.material ?? "plastic";
    must<HTMLInputElement>("prop-emissive").value = this.safeHex(entity.emissive, "#000000");
    must<HTMLInputElement>("prop-transparency").value = String(entity.transparency ?? 0);
    must<HTMLInputElement>("prop-texture").value = entity.texture ?? "";
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
        components.Collider = {
          enabled: true,
          mode: "mesh",
          size: entity.size ? [...entity.size] : [2, 2, 2],
          offset: [0, 0, 0]
        };
        break;
      case "Trigger":
        components.Trigger = {
          enabled: true,
          size: entity.kind === "empty"
            ? [4, 4, 4]
            : entity.size ? [...entity.size] : [4, 4, 4],
          offset: [0, 0, 0]
        };
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
      case "Particle":
        components.Particle = {
          enabled: true,
          preset: "energy",
          color: "#b7f34a",
          color2: "#5ed0ff",
          emitRate: 55,
          capacity: 400,
          lifetime: 1.1,
          size: 0.28,
          speed: 1.8,
          autoplay: true
        };
        break;
      case "UI":
        components.UI = {
          type: "text", text: "Text", x: 16, y: 16, width: 220, height: 40,
          fontSize: 18, color: "#ffffff", background: "transparent", visible: true, anchor: "top-left"
        };
        break;
      case "Model":
        components.Model = {
          src: "",
          animationAutoplay: false,
          animationLoop: true,
          animationSpeed: 1
        };
        break;
      case "Spawn":
        components.Spawn = { enabled: true };
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
        this.forge.rebuildEntity(entity.id);
        this.setSelection(entity.id);
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

        this.appendSelectField(container, "Mode", component.mode ?? "mesh", [
          ["mesh", "Mesh"],
          ["box", "Box Proxy"]
        ], (value) => {
          component.mode = value as "mesh" | "box";
          if (component.mode === "box") {
            component.size ??= entity.size ? [...entity.size] : [2, 2, 2];
            component.offset ??= [0, 0, 0];
          }
        });

        if ((component.mode ?? "mesh") === "box") {
          const size = component.size ?? (entity.size ? [...entity.size] : [2, 2, 2]);
          const offset = component.offset ?? [0, 0, 0];
          component.size = size;
          component.offset = offset;

          this.appendNumberField(container, "Size X", size[0], 0.1, (value) => {
            component.size = [Math.max(0.05, Math.abs(value)), size[1], size[2]];
          });
          this.appendNumberField(container, "Size Y", size[1], 0.1, (value) => {
            component.size = [size[0], Math.max(0.05, Math.abs(value)), size[2]];
          });
          this.appendNumberField(container, "Size Z", size[2], 0.1, (value) => {
            component.size = [size[0], size[1], Math.max(0.05, Math.abs(value))];
          });

          this.appendNumberField(container, "Offset X", offset[0], 0.1, (value) => {
            component.offset = [value, offset[1], offset[2]];
          });
          this.appendNumberField(container, "Offset Y", offset[1], 0.1, (value) => {
            component.offset = [offset[0], value, offset[2]];
          });
          this.appendNumberField(container, "Offset Z", offset[2], 0.1, (value) => {
            component.offset = [offset[0], offset[1], value];
          });

          const actions = document.createElement("div");
          actions.className = "component-actions";

          const fit = document.createElement("button");
          fit.type = "button";
          fit.dataset.colliderFit = entity.id;
          fit.textContent = "Fit Proxy To Visual";
          fit.addEventListener("click", () => {
            this.checkpoint();
            if (!this.forge.fitBoxColliderToVisual(entity.id)) {
              this.log(`Could not fit collider: visual geometry for ${entity.name} is not loaded yet.`);
              return;
            }
            this.setSelection(entity.id);
            this.renderInspector();
            this.log(`Collider fitted to visual bounds: ${entity.name}.`);
          });

          const reset = document.createElement("button");
          reset.type = "button";
          reset.dataset.colliderReset = entity.id;
          reset.textContent = "Reset Proxy";
          reset.addEventListener("click", () => {
            this.checkpoint();
            if (!this.forge.resetBoxCollider(entity.id)) return;
            this.setSelection(entity.id);
            this.renderInspector();
            this.log(`Collider reset: ${entity.name}.`);
          });

          actions.append(fit, reset);
          container.appendChild(actions);

          const note = document.createElement("div");
          note.className = "component-note";
          note.textContent = "Box Proxy uses this local volume for collisions instead of the visible mesh.";
          container.appendChild(note);
        }

        break;
      }
      case "Trigger": {
        const component = components.Trigger;
        if (!component) return;

        this.appendCheckboxField(container, "Enabled", component.enabled, (value) => {
          component.enabled = value;
        });

        const size = component.size ?? (entity.size ? [...entity.size] : [4, 4, 4]);
        const offset = component.offset ?? [0, 0, 0];
        component.size = size;
        component.offset = offset;

        this.appendNumberField(container, "Size X", size[0], 0.1, (value) => {
          component.size = [Math.max(0.05, Math.abs(value)), size[1], size[2]];
        });
        this.appendNumberField(container, "Size Y", size[1], 0.1, (value) => {
          component.size = [size[0], Math.max(0.05, Math.abs(value)), size[2]];
        });
        this.appendNumberField(container, "Size Z", size[2], 0.1, (value) => {
          component.size = [size[0], size[1], Math.max(0.05, Math.abs(value))];
        });
        this.appendNumberField(container, "Offset X", offset[0], 0.1, (value) => {
          component.offset = [value, offset[1], offset[2]];
        });
        this.appendNumberField(container, "Offset Y", offset[1], 0.1, (value) => {
          component.offset = [offset[0], value, offset[2]];
        });
        this.appendNumberField(container, "Offset Z", offset[2], 0.1, (value) => {
          component.offset = [offset[0], offset[1], value];
        });

        const note = document.createElement("div");
        note.className = "component-note";
        note.textContent = "Trigger Volume does not block movement. Scripts receive enter/exit events in Play.";
        container.appendChild(note);
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
      case "Light": {
        const component = components.Light;
        if (!component) return;
        this.appendSelectField(container, "Type", component.type, [
          ["point", "Point"],
          ["spot", "Spot"]
        ], (value) => {
          component.type = value as "point" | "spot";
        });
        this.appendTextField(container, "Color", component.color ?? "#ffffff", (value) => {
          component.color = value || "#ffffff";
        });
        this.appendNumberField(container, "Intensity", component.intensity ?? 1, 0.1, (value) => {
          component.intensity = Math.max(0, value);
        });
        this.appendNumberField(container, "Range", component.range ?? 20, 1, (value) => {
          component.range = Math.max(0, value);
        });
        if (component.type === "spot") {
          this.appendNumberField(container, "Angle °", (component.angle ?? Math.PI / 3) * 180 / Math.PI, 1, (value) => {
            component.angle = Math.max(1, value) * Math.PI / 180;
          });
        }
        break;
      }
      case "Sound": {
        const component = components.Sound;
        if (!component) return;
        this.appendTextField(container, "Audio URL", component.src, (value) => {
          component.src = value;
        });
        this.appendNumberField(container, "Volume", component.volume ?? 1, 0.05, (value) => {
          component.volume = Math.min(1, Math.max(0, value));
        });
        this.appendCheckboxField(container, "Loop", component.loop ?? false, (value) => {
          component.loop = value;
        });
        this.appendCheckboxField(container, "Autoplay", component.autoplay ?? false, (value) => {
          component.autoplay = value;
        });
        this.appendCheckboxField(container, "Spatial 3D", component.spatial ?? true, (value) => {
          component.spatial = value;
        });
        this.appendNumberField(container, "Max distance", component.maxDistance ?? 40, 1, (value) => {
          component.maxDistance = Math.max(1, value);
        });
        if (component.fileName) {
          const note = document.createElement("div");
          note.className = "component-note";
          note.textContent = `Imported file: ${component.fileName}`;
          container.appendChild(note);
        }
        break;
      }
      case "Particle": {
        const component = components.Particle;
        if (!component) return;
        this.appendCheckboxField(container, "Enabled", component.enabled ?? true, (value) => {
          component.enabled = value;
        });
        this.appendSelectField(container, "Preset", component.preset ?? "energy", [
          ["energy", "Energy"],
          ["sparks", "Sparks"],
          ["smoke", "Smoke"]
        ], (value) => {
          component.preset = value as "energy" | "sparks" | "smoke";
        });
        this.appendTextField(container, "Color A", component.color ?? "#b7f34a", (value) => {
          component.color = value || "#b7f34a";
        });
        this.appendTextField(container, "Color B", component.color2 ?? "#5ed0ff", (value) => {
          component.color2 = value || "#5ed0ff";
        });
        this.appendNumberField(container, "Emit rate", component.emitRate ?? 55, 1, (value) => {
          component.emitRate = Math.max(0, value);
        });
        this.appendNumberField(container, "Capacity", component.capacity ?? 400, 16, (value) => {
          component.capacity = Math.max(16, Math.min(5000, Math.round(value)));
        });
        this.appendNumberField(container, "Lifetime", component.lifetime ?? 1.1, 0.1, (value) => {
          component.lifetime = Math.max(0.05, value);
        });
        this.appendNumberField(container, "Particle size", component.size ?? 0.28, 0.05, (value) => {
          component.size = Math.max(0.02, value);
        });
        this.appendNumberField(container, "Speed", component.speed ?? 1.8, 0.1, (value) => {
          component.speed = Math.max(0, value);
        });
        this.appendCheckboxField(container, "Autoplay in Play", component.autoplay ?? true, (value) => {
          component.autoplay = value;
        });
        break;
      }
      case "UI": {
        const component = components.UI;
        if (!component) return;
        this.appendSelectField(container, "UI type", component.type, [
          ["text", "Text"],
          ["button", "Button"],
          ["panel", "Panel"]
        ], (value) => {
          component.type = value as "text" | "button" | "panel";
        });
        this.appendTextField(container, "Text", component.text ?? "", (value) => {
          component.text = value;
        });
        this.appendSelectField(container, "Anchor", component.anchor ?? "top-left", [
          ["top-left", "Top Left"],
          ["top-center", "Top Center"],
          ["center", "Center"],
          ["bottom-center", "Bottom Center"]
        ], (value) => {
          component.anchor = value as "top-left" | "top-center" | "center" | "bottom-center";
        });
        this.appendNumberField(container, "X", component.x ?? 0, 1, (value) => {
          component.x = value;
        });
        this.appendNumberField(container, "Y", component.y ?? 0, 1, (value) => {
          component.y = value;
        });
        this.appendNumberField(container, "Width", component.width ?? 180, 1, (value) => {
          component.width = Math.max(1, value);
        });
        this.appendNumberField(container, "Height", component.height ?? 40, 1, (value) => {
          component.height = Math.max(1, value);
        });
        this.appendNumberField(container, "Font size", component.fontSize ?? 18, 1, (value) => {
          component.fontSize = Math.max(8, value);
        });
        this.appendTextField(container, "Text color", component.color ?? "#ffffff", (value) => {
          component.color = value || "#ffffff";
        });
        this.appendTextField(container, "Background", component.background ?? "transparent", (value) => {
          component.background = value || "transparent";
        });
        this.appendCheckboxField(container, "Visible", component.visible ?? true, (value) => {
          component.visible = value;
        });
        break;
      }
      case "Spawn": {
        const component = components.Spawn;
        if (!component) return;
        this.appendCheckboxField(container, "Enabled", component.enabled, (value) => {
          component.enabled = value;
        });
        break;
      }
      case "Model": {
        const component = components.Model;
        if (!component) return;
        this.appendTextField(container, "GLB / glTF URL", component.src, (value) => {
          component.src = value;
        });

        const modelMesh = this.forge.getMesh(entity.id);
        const animationClips = (
          modelMesh?.metadata as { modelAnimationClips?: string[] } | null
        )?.modelAnimationClips ?? [];

        const clipLabel = document.createElement("label");
        clipLabel.textContent = "Animation clip";
        const clipSelect = document.createElement("select");
        clipSelect.dataset.modelAnimationClip = entity.id;

        const automatic = document.createElement("option");
        automatic.value = "";
        automatic.textContent = animationClips.length > 0
          ? `First clip (${animationClips[0]})`
          : "First available clip";
        clipSelect.appendChild(automatic);

        for (const clipName of animationClips) {
          const option = document.createElement("option");
          option.value = clipName;
          option.textContent = clipName;
          clipSelect.appendChild(option);
        }

        clipSelect.value = component.animation ?? "";
        clipSelect.addEventListener("change", () => {
          this.checkpoint();
          component.animation = clipSelect.value || undefined;
          this.log(`Animation clip: ${clipSelect.value || "first available"}.`);
        });
        clipLabel.appendChild(clipSelect);
        container.appendChild(clipLabel);

        const autoplayRow = document.createElement("div");
        autoplayRow.className = "component-checkbox-row";
        const autoplay = document.createElement("input");
        autoplay.type = "checkbox";
        autoplay.id = `model-animation-autoplay-${entity.id}`;
        autoplay.dataset.modelAnimationAutoplay = entity.id;
        autoplay.checked = component.animationAutoplay ?? false;
        autoplay.addEventListener("change", () => {
          this.checkpoint();
          component.animationAutoplay = autoplay.checked;
          this.log(`Animation autoplay: ${autoplay.checked ? "on" : "off"}.`);
        });
        const autoplayLabel = document.createElement("label");
        autoplayLabel.htmlFor = autoplay.id;
        autoplayLabel.textContent = "Autoplay in Play";
        autoplayRow.append(autoplayLabel, autoplay);
        container.appendChild(autoplayRow);

        const loopRow = document.createElement("div");
        loopRow.className = "component-checkbox-row";
        const loop = document.createElement("input");
        loop.type = "checkbox";
        loop.id = `model-animation-loop-${entity.id}`;
        loop.dataset.modelAnimationLoop = entity.id;
        loop.checked = component.animationLoop ?? true;
        loop.addEventListener("change", () => {
          this.checkpoint();
          component.animationLoop = loop.checked;
          this.log(`Animation loop: ${loop.checked ? "on" : "off"}.`);
        });
        const loopLabel = document.createElement("label");
        loopLabel.htmlFor = loop.id;
        loopLabel.textContent = "Loop";
        loopRow.append(loopLabel, loop);
        container.appendChild(loopRow);

        const speedLabel = document.createElement("label");
        speedLabel.textContent = "Animation speed";
        const speed = document.createElement("input");
        speed.type = "number";
        speed.dataset.modelAnimationSpeed = entity.id;
        speed.min = "0.05";
        speed.max = "4";
        speed.step = "0.05";
        speed.value = String(component.animationSpeed ?? 1);
        speed.addEventListener("change", () => {
          const next = Math.min(4, Math.max(0.05, Number(speed.value) || 1));
          this.checkpoint();
          component.animationSpeed = next;
          speed.value = String(next);
        });
        speedLabel.appendChild(speed);
        container.appendChild(speedLabel);

        const clipNote = document.createElement("div");
        clipNote.className = "component-note";
        clipNote.textContent = animationClips.length > 0
          ? `Clips: ${animationClips.join(", ")}`
          : component.src
            ? "Animation clips will appear after the model finishes loading."
            : "Import an animated GLB to discover clips.";
        container.appendChild(clipNote);

        const animationActions = document.createElement("div");
        animationActions.className = "component-actions";

        const preview = document.createElement("button");
        preview.type = "button";
        preview.dataset.modelAnimationPreview = entity.id;
        preview.textContent = "Preview Animation";
        preview.disabled = animationClips.length === 0;
        preview.addEventListener("click", () => {
          if (!this.forge.playModelAnimation(entity.id, component.animation)) {
            this.log(`No animation clip available on ${entity.name}.`);
            return;
          }
          this.log(`Previewing animation on ${entity.name}.`);
        });

        const stop = document.createElement("button");
        stop.type = "button";
        stop.dataset.modelAnimationStop = entity.id;
        stop.textContent = "Stop";
        stop.disabled = animationClips.length === 0;
        stop.addEventListener("click", () => {
          this.forge.stopModelAnimation(entity.id);
        });

        animationActions.append(preview, stop);
        container.appendChild(animationActions);

        if (component.fileName) {
          const note = document.createElement("div");
          note.className = "component-note";
          note.textContent = `Imported file: ${component.fileName}`;
          container.appendChild(note);
        }
        break;
      }
      case "Script": {
        const component = components.Script;
        if (!component) return;
        this.appendSelectField(container, "Type", component.kind ?? "Script", [
          ["Script", "Script"],
          ["LocalScript", "LocalScript"],
          ["ModuleScript", "ModuleScript"]
        ], (value) => {
          component.kind = value as ForgeScriptKind;
        });
        this.appendCheckboxField(container, "Enabled", component.enabled ?? true, (value) => {
          component.enabled = value;
        });
        this.appendTextField(container, "Script name", component.name, (value) => {
          component.name = value;
        });

        const open = document.createElement("button");
        open.type = "button";
        open.textContent = component.source?.trim() ? "Open Code" : "Write Code";
        open.addEventListener("click", () => this.openScriptEditor(entity.id));
        container.appendChild(open);
        break;
      }
    }
  }

  private defaultScriptSource(kind: ForgeScriptKind = "Script"): string {
    if (kind === "ModuleScript") {
      return `Forge.module({
  clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  },

  hello(name) {
    return "Hello " + name;
  }
});
`;
    }

    if (kind === "LocalScript") {
      return `Forge.onStart(() => {
  Forge.log("LocalScript started");
});

Forge.onKeyDown((code) => {
  if (code === "KeyF") {
    Forge.log("F was pressed");
  }
});

Forge.onUpdate((dt) => {
  // Local player / camera behavior belongs here.
});
`;
    }

    return `Forge.onStart(() => {
  Forge.log(Forge.script.name + " started");
});

Forge.onInteract(() => {
  const target = Forge.parent ?? Forge.self;
  target.move(0, 1, 0);
});

Forge.onUpdate((dt) => {
  // Game logic runs here every frame.
});
`;
  }

  private openScriptEditor(entityId = this.selectedId): void {
    if (this.mode !== "editor") return;

    if (!entityId) {
      this.log("Select a Script object or an object with a Script component.");
      return;
    }

    const entity = this.forge.getEntity(entityId);
    if (!entity) return;

    this.scriptEditingEntityId = entity.id;
    const script = entity.components?.Script;
    const kind = script?.kind ?? "Script";

    this.scriptTarget.textContent = entity.parentId
      ? `${entity.name} • child of ${entity.parentId}`
      : entity.name;
    this.scriptKind.value = kind;
    this.scriptName.value = script?.name || `custom.${entity.id}`;
    this.scriptSource.value = script?.source?.trim()
      ? script.source
      : this.defaultScriptSource(kind);

    this.scriptDialog.showModal();
    requestAnimationFrame(() => this.scriptSource.focus());
  }

  private saveScriptEditor(): void {
    if (this.mode !== "editor" || !this.scriptEditingEntityId) return;

    const entity = this.forge.getEntity(this.scriptEditingEntityId);
    if (!entity) return;

    const syntaxError = this.getScriptSyntaxError();
    if (syntaxError) {
      this.log(`SCRIPT SYNTAX ERROR: ${syntaxError}`);
      return;
    }

    this.checkpoint();
    const components = entity.components ?? (entity.components = {});
    components.Script = {
      name: this.scriptName.value.trim() || `custom.${entity.id}`,
      kind: this.scriptKind.value as ForgeScriptKind,
      enabled: true,
      source: this.scriptSource.value
    };

    this.renderInspector();
    this.log(`Saved ${components.Script.kind}: ${components.Script.name} • runs in Play`);
  }

  private getScriptSyntaxError(): string | null {
    try {
      new Function("Forge", `"use strict";\n${this.scriptSource.value}`);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  private checkScriptSyntax(): void {
    const error = this.getScriptSyntaxError();
    if (error) {
      this.log(`SCRIPT SYNTAX ERROR: ${error}`);
      return;
    }

    this.log(`${this.scriptKind.value} syntax OK • ready to save and Play.`);
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
      if (this.selectedId) {
        const selectedId = this.selectedId;
        this.forge.rebuildEntity(selectedId);
        this.setSelection(selectedId);
      }
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
      if (this.selectedId) {
        const selectedId = this.selectedId;
        this.forge.rebuildEntity(selectedId);
        this.setSelection(selectedId);
      }
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
      if (this.selectedId) {
        const selectedId = this.selectedId;
        this.forge.rebuildEntity(selectedId);
        this.setSelection(selectedId);
      }
      this.renderInspector();
      this.log(`${labelText} updated.`);
    });

    label.appendChild(input);
    container.appendChild(label);
  }

  private appendSelectField(
    container: HTMLDivElement,
    labelText: string,
    value: string,
    options: Array<[string, string]>,
    apply: (value: string) => void
  ): void {
    const label = document.createElement("label");
    label.textContent = labelText;

    const select = document.createElement("select");
    for (const [optionValue, optionLabel] of options) {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = optionLabel;
      select.appendChild(option);
    }
    select.value = value;

    select.addEventListener("change", () => {
      this.checkpoint();
      apply(select.value);
      if (this.selectedId) {
        const selectedId = this.selectedId;
        this.forge.rebuildEntity(selectedId);
        this.setSelection(selectedId);
      }
      this.renderInspector();
      this.log(`${labelText} updated.`);
    });

    label.appendChild(select);
    container.appendChild(label);
  }

  private renderParentOptions(entity: ForgeEntity): void {
    const select = must<HTMLSelectElement>("prop-parent");
    select.replaceChildren();

    const workspace = document.createElement("option");
    workspace.value = "";
    workspace.textContent = "Workspace";
    select.appendChild(workspace);

    for (const candidate of this.forge.document.entities) {
      if (candidate.id === entity.id) continue;
      if (this.wouldCreateParentCycle(entity.id, candidate.id)) continue;

      const option = document.createElement("option");
      option.value = candidate.id;
      option.textContent = candidate.name;
      select.appendChild(option);
    }

    select.value = entity.parentId ?? "";
  }

  private wouldCreateParentCycle(entityId: string, parentId: string): boolean {
    let current: string | undefined = parentId;
    const visited = new Set<string>();

    while (current) {
      if (current === entityId) return true;
      if (visited.has(current)) return true;
      visited.add(current);
      current = this.forge.getEntity(current)?.parentId;
    }

    return false;
  }

  private applyParentSelection(): void {
    if (!this.selectedId) return;
    const entity = this.forge.getEntity(this.selectedId);
    if (!entity) return;

    const selectedParent = must<HTMLSelectElement>("prop-parent").value || undefined;
    if (selectedParent && this.wouldCreateParentCycle(entity.id, selectedParent)) {
      this.renderInspector();
      this.log("Parenting blocked: that would create a hierarchy cycle.");
      return;
    }

    this.reparentEntity(entity.id, selectedParent);
  }

  private reparentEntity(entityId: string, parentId?: string): void {
    const entity = this.forge.getEntity(entityId);
    if (!entity) return;

    if (parentId && this.wouldCreateParentCycle(entityId, parentId)) {
      this.log("Parenting blocked: that would create a hierarchy cycle.");
      return;
    }

    this.checkpoint();
    if (!this.forge.setEntityParent(entityId, parentId)) return;

    this.renderTree();
    if (this.selectedId === entityId) this.renderInspector();
    this.log(parentId
      ? `${entity.name} moved inside ${this.forge.getEntity(parentId)?.name ?? parentId}.`
      : `${entity.name} moved to Workspace.`);
  }

  private safeHex(value: string | undefined, fallback: string): string {
    return /^#[0-9a-fA-F]{6}$/.test(value ?? "") ? value! : fallback;
  }

  private applyAppearance(): void {
    if (!this.selectedId) return;
    const entity = this.forge.getEntity(this.selectedId);
    if (!entity) return;

    this.checkpoint();
    entity.color = must<HTMLInputElement>("prop-color").value;
    entity.material = must<HTMLSelectElement>("prop-material").value as ForgeEntity["material"];
    const emissive = must<HTMLInputElement>("prop-emissive").value;
    entity.emissive = emissive === "#000000" ? undefined : emissive;
    entity.transparency = Math.min(
      1,
      Math.max(0, Number(must<HTMLInputElement>("prop-transparency").value) || 0)
    );
    entity.texture = must<HTMLInputElement>("prop-texture").value.trim() || undefined;
    if (!entity.texture) entity.textureFileName = undefined;

    this.forge.rebuildEntity(entity.id);
    this.setSelection(entity.id);
    this.renderInspector();
    this.log(`Appearance updated for ${entity.name}.`);
  }

  private applyInspectorSize(): void {
    if (!this.selectedId) return;
    const entity = this.forge.getEntity(this.selectedId);
    const mesh = this.forge.getMesh(this.selectedId);
    if (!entity || !mesh) return;

    const base = entity.size ?? [1, 1, 1];
    const wanted = [
      Math.max(0.01, Number(must<HTMLInputElement>("size-x").value)),
      Math.max(0.01, Number(must<HTMLInputElement>("size-y").value)),
      Math.max(0.01, Number(must<HTMLInputElement>("size-z").value))
    ];

    mesh.scaling.set(
      wanted[0] / Math.max(0.0001, Math.abs(base[0])),
      wanted[1] / Math.max(0.0001, Math.abs(base[1])),
      wanted[2] / Math.max(0.0001, Math.abs(base[2]))
    );

    this.forge.syncEntityFromMesh(this.selectedId);
    this.renderInspector();
    this.log(`Resized ${entity.name} to ${wanted.map((value) => value.toFixed(2)).join(" × ")}.`);
  }

  private applyEnvironmentPreset(name: string): void {
    if (this.mode !== "editor") return;

    const presets: Record<string, {
      skyColor: string;
      ambientColor: string;
      fogColor: string;
      fogDensity: number;
    }> = {
      day: {
        skyColor: "#7fb9e8",
        ambientColor: "#d9e8f4",
        fogColor: "#9fc6df",
        fogDensity: 0
      },
      sunset: {
        skyColor: "#d88463",
        ambientColor: "#f0c39f",
        fogColor: "#b8756a",
        fogDensity: 0.004
      },
      night: {
        skyColor: "#17263f",
        ambientColor: "#6f86aa",
        fogColor: "#263b59",
        fogDensity: 0.006
      },
      foggy: {
        skyColor: "#8c9aa3",
        ambientColor: "#bac3c8",
        fogColor: "#aab5bb",
        fogDensity: 0.025
      }
    };

    const preset = presets[name];
    if (!preset) return;

    this.checkpoint();
    this.forge.document.environment = {
      ...preset,
      skyTexture: undefined,
      skyTextureFileName: undefined
    };
    this.forge.applyEnvironment(this.forge.document.environment);
    this.syncEnvironmentInputs();
    this.canvas.dataset.environmentPreset = name;
    this.log(`Environment preset: ${name}.`);
  }

  private syncEnvironmentInputs(): void {
    const environment = this.forge.document.environment ?? {};
    must<HTMLInputElement>("env-sky").value = environment.skyColor ?? "#7fb9e8";
    must<HTMLInputElement>("env-ambient").value = environment.ambientColor ?? "#d9e8f4";
    must<HTMLInputElement>("env-fog").value = environment.fogColor ?? "#9fc6df";
    must<HTMLInputElement>("env-fog-density").value = String(environment.fogDensity ?? 0);
    must<HTMLDivElement>("sky-file-label").textContent =
      environment.skyTextureFileName ? `Sky: ${environment.skyTextureFileName}` : "Color sky";
  }

  private syncPlayerInputs(): void {
    const player = this.forge.document.player ?? {};
    const colliderHeight = player.colliderHeight ?? 3.05;
    const colliderRadius = player.colliderRadius ?? 0.45;
    const walkSpeed = player.walkSpeed ?? 5.05;
    const runSpeed = player.runSpeed ?? 8;
    const jumpPower = player.jumpPower ?? 7.9;
    const maxHealth = player.maxHealth ?? 100;
    const autoRespawn = player.autoRespawn ?? true;

    must<HTMLInputElement>("player-collider-height").value = String(colliderHeight);
    must<HTMLInputElement>("player-collider-radius").value = String(colliderRadius);
    must<HTMLInputElement>("player-walk-speed").value = String(walkSpeed);
    must<HTMLInputElement>("player-run-speed").value = String(runSpeed);
    must<HTMLInputElement>("player-jump-power").value = String(jumpPower);
    must<HTMLInputElement>("player-max-health").value = String(maxHealth);
    must<HTMLInputElement>("player-auto-respawn").checked = autoRespawn;

    this.canvas.dataset.scenePlayerCollider =
      `${Number(colliderHeight).toFixed(3)},${Number(colliderRadius).toFixed(3)}`;
    this.canvas.dataset.scenePlayerMovement =
      `${Number(walkSpeed).toFixed(3)},${Number(runSpeed).toFixed(3)},${Number(jumpPower).toFixed(3)}`;
    this.canvas.dataset.scenePlayerHealth =
      `${Number(maxHealth).toFixed(3)},${String(autoRespawn)}`;
  }

  private applyPlayerInputs(): void {
    if (this.mode !== "editor") return;
    this.checkpoint();

    const radiusInput = must<HTMLInputElement>("player-collider-radius");
    const heightInput = must<HTMLInputElement>("player-collider-height");
    const walkInput = must<HTMLInputElement>("player-walk-speed");
    const runInput = must<HTMLInputElement>("player-run-speed");
    const jumpInput = must<HTMLInputElement>("player-jump-power");
    const maxHealthInput = must<HTMLInputElement>("player-max-health");
    const autoRespawnInput = must<HTMLInputElement>("player-auto-respawn");

    const radius = Math.min(2, Math.max(0.2, Number(radiusInput.value) || 0.45));
    const requestedHeight = Math.min(8, Math.max(1, Number(heightInput.value) || 3.05));
    const height = Math.max(requestedHeight, radius * 2.1);
    const walkSpeed = Math.min(20, Math.max(1, Number(walkInput.value) || 5.05));
    const runSpeed = Math.min(30, Math.max(walkSpeed, Number(runInput.value) || 8));
    const jumpPower = Math.min(20, Math.max(1, Number(jumpInput.value) || 7.9));
    const maxHealth = Math.min(100000, Math.max(1, Number(maxHealthInput.value) || 100));
    const autoRespawn = autoRespawnInput.checked;

    this.forge.document.player = {
      ...(this.forge.document.player ?? {}),
      colliderHeight: height,
      colliderRadius: radius,
      walkSpeed,
      runSpeed,
      jumpPower,
      maxHealth,
      autoRespawn
    };

    heightInput.value = String(height);
    radiusInput.value = String(radius);
    walkInput.value = String(walkSpeed);
    runInput.value = String(runSpeed);
    jumpInput.value = String(jumpPower);
    maxHealthInput.value = String(maxHealth);

    this.canvas.dataset.scenePlayerCollider = `${height.toFixed(3)},${radius.toFixed(3)}`;
    this.canvas.dataset.scenePlayerMovement =
      `${walkSpeed.toFixed(3)},${runSpeed.toFixed(3)},${jumpPower.toFixed(3)}`;
    this.canvas.dataset.scenePlayerHealth = `${maxHealth.toFixed(3)},${String(autoRespawn)}`;

    this.log(
      `Player settings updated: collider ${height.toFixed(2)} × ${radius.toFixed(2)} • `
      + `walk ${walkSpeed.toFixed(2)} • run ${runSpeed.toFixed(2)} • jump ${jumpPower.toFixed(2)} • `
      + `health ${maxHealth.toFixed(0)} • auto-respawn ${autoRespawn ? "on" : "off"}.`
    );
  }

  private applyEnvironmentInputs(): void {
    if (this.mode !== "editor") return;
    this.checkpoint();

    const current = this.forge.document.environment ?? {};
    this.forge.document.environment = {
      ...current,
      skyColor: must<HTMLInputElement>("env-sky").value,
      ambientColor: must<HTMLInputElement>("env-ambient").value,
      fogColor: must<HTMLInputElement>("env-fog").value,
      fogDensity: Math.min(0.1, Math.max(0, Number(must<HTMLInputElement>("env-fog-density").value) || 0))
    };

    this.forge.applyEnvironment(this.forge.document.environment);
    delete this.canvas.dataset.environmentPreset;
    this.log("Lighting / sky environment updated.");
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
    this.forge.loadDocument(sceneDocument, false);
    this.forge.mountUI(this.uiRoot, false);
    this.syncEnvironmentInputs();
    this.syncPlayerInputs();

    if (wantedSelection && this.forge.getEntity(wantedSelection)) {
      this.setSelection(wantedSelection);
    }

    this.renderTree();
    this.renderInspector();
    this.renderProjectPrefabs();
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
    this.forge.loadDocument(this.playSnapshot, true, false);
    this.forge.mountUI(this.uiRoot, true);
    this.mode = "play";
    this.gizmos.positionGizmoEnabled = false;
    this.gizmos.rotationGizmoEnabled = false;
    this.gizmos.scaleGizmoEnabled = false;
    this.editorCamera.detachControl();
    this.editorNavKeys.clear();
    this.rightMouseNavigation = false;

    const spawn = this.forge.getPlayerSpawn([0, 2.2, 20]);
    this.player = new PlayerController(
      this.forge,
      spawn,
      (message) => this.log(message),
      (text, locked) => this.setInteractionPrompt(text, locked),
      {
        colliderHeight: this.forge.document.player?.colliderHeight,
        colliderRadius: this.forge.document.player?.colliderRadius,
        walkSpeed: this.forge.document.player?.walkSpeed,
        runSpeed: this.forge.document.player?.runSpeed,
        jumpPower: this.forge.document.player?.jumpPower,
        maxHealth: this.forge.document.player?.maxHealth,
        autoRespawn: this.forge.document.player?.autoRespawn
      }
    );

    this.forge.scripts.setPlayerAPI({
      setCheckpoint: (idOrName) => this.player?.setCheckpoint(idOrName) ?? false,
      respawn: () => this.player?.respawn() ?? false,
      getHealth: () => this.player?.getHealth() ?? 0,
      getMaxHealth: () => this.player?.getMaxHealth() ?? 0,
      isDead: () => this.player?.isDead() ?? false,
      damage: (amount) => this.player?.damage(amount) ?? 0,
      heal: (amount) => this.player?.heal(amount) ?? 0
    });

    // Scripts start only after the player and gameplay camera exist.
    this.forge.startRuntimeScripts();

    must<HTMLButtonElement>("play").disabled = true;
    must<HTMLButtonElement>("stop").disabled = false;
    this.modeBadge.textContent = "PLAY";
    this.modeBadge.classList.add("playing");
    this.renderTree();
    this.renderInspector();
    this.renderProjectPrefabs();
    this.updateHistoryUI();
  }

  private exitPlayMode(): void {
    if (this.mode !== "play") return;

    this.player?.dispose();
    this.player = null;
    this.mode = "editor";

    if (this.playSnapshot) {
      this.forge.loadDocument(this.playSnapshot, false);
      this.forge.mountUI(this.uiRoot, false);
      this.syncPlayerInputs();
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
    this.renderProjectPrefabs();
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
    this.forge.loadDocument(sceneDocument, false);
    this.forge.mountUI(this.uiRoot, false);
    this.syncEnvironmentInputs();
    this.syncPlayerInputs();
    this.renderTree();
    this.renderInspector();
    this.renderProjectPrefabs();
    this.updateHistoryUI();
    this.log(message);
  }

  private isForgeSceneDocument(value: unknown): value is ForgeSceneDocument {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<ForgeSceneDocument>;
    return candidate.format === "forge.scene"
      && candidate.version === 1
      && typeof candidate.name === "string"
      && Array.isArray(candidate.entities)
      && (
        candidate.prefabs === undefined
        || (
          Array.isArray(candidate.prefabs)
          && candidate.prefabs.every((prefab) => this.isForgePrefabDocument(prefab))
        )
      );
  }

  private isForgePrefabDocument(value: unknown): value is ForgePrefabDocument {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<ForgePrefabDocument>;
    if (
      candidate.format !== "forge.prefab"
      || candidate.version !== 1
      || typeof candidate.name !== "string"
      || !Array.isArray(candidate.entities)
      || candidate.entities.length === 0
    ) return false;

    const validKinds = new Set<ForgePrimitive>([
      "box", "wedge", "sphere", "capsule", "cylinder", "ground", "empty", "model"
    ]);
    const ids = new Set<string>();

    for (const entity of candidate.entities) {
      if (
        !entity
        || typeof entity !== "object"
        || typeof entity.id !== "string"
        || !entity.id
        || ids.has(entity.id)
        || typeof entity.name !== "string"
        || !validKinds.has(entity.kind)
        || !Array.isArray(entity.position)
        || entity.position.length !== 3
        || entity.position.some((coordinate) => !Number.isFinite(coordinate))
      ) return false;
      ids.add(entity.id);
    }

    for (const entity of candidate.entities) {
      if (entity.parentId && !ids.has(entity.parentId)) return false;

      const seen = new Set<string>([entity.id]);
      let parentId = entity.parentId;
      while (parentId) {
        if (seen.has(parentId)) return false;
        seen.add(parentId);
        parentId = candidate.entities.find((item) => item.id === parentId)?.parentId;
      }
    }

    return true;
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

    const line = document.createElement("div");
    line.className = message.includes("ERROR") ? "output-line error"
      : message.includes("WARN") ? "output-line warn"
      : "output-line";
    line.textContent = message;
    this.outputLog.appendChild(line);

    while (this.outputLog.childElementCount > 120) {
      this.outputLog.firstElementChild?.remove();
    }

    this.outputLog.scrollTop = this.outputLog.scrollHeight;
  }
}
