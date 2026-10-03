import {
  ArcRotateCamera,
  GizmoManager,
  PointerEventTypes,
  Vector3
} from "@babylonjs/core";
import type { ForgePrimitive, ForgeSceneDocument } from "../types";
import { ForgeEngine } from "../engine/ForgeEngine";
import { registerDefaultScripts } from "../engine/defaultScripts";
import { PlayerController } from "../player/PlayerController";
import { HistoryManager } from "./HistoryManager";

type ToolMode = "move" | "rotate" | "scale";
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

  private readonly tree = must<HTMLDivElement>("scene-tree");
  private readonly status = must<HTMLSpanElement>("status");
  private readonly fps = must<HTMLDivElement>("fps");
  private readonly historyState = must<HTMLDivElement>("history-state");
  private readonly modeBadge = must<HTMLDivElement>("mode-badge");
  private readonly inspectorEmpty = must<HTMLDivElement>("inspector-empty");
  private readonly inspectorFields = must<HTMLDivElement>("inspector-fields");
  private readonly componentList = must<HTMLDivElement>("component-list");

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
    this.editorCamera.attachControl(canvas, true);
    this.forge.scene.activeCamera = this.editorCamera;

    this.gizmos = new GizmoManager(this.forge.scene);
    this.gizmos.usePointerToAttachGizmos = false;
    this.gizmos.positionGizmoEnabled = true;

    this.bindUI();
    this.bindScenePicking();
    this.bindKeyboard();
    this.bindEditorNavigation();
    this.setTool("move");
    this.updateHistoryUI();
  }

  async init(): Promise<void> {
    const response = await fetch("/scenes/project-helios.forge.json");
    if (!response.ok) throw new Error(`Failed to load Project Helios scene: ${response.status}`);

    const sceneDocument = await response.json() as ForgeSceneDocument;
    this.forge.loadDocument(sceneDocument);
    this.history.clear();
    this.renderTree();
    this.renderInspector();
    this.updateHistoryUI();
    this.startLoop();
  }

  private startLoop(): void {
    let previous = performance.now();

    this.forge.engine.runRenderLoop(() => {
      const now = performance.now();
      const dt = Math.min((now - previous) / 1000, 0.05);
      previous = now;

      if (this.mode === "play") {
        this.player?.update(dt);
        this.forge.scripts.tick(dt);
      } else {
        this.updateEditorCamera(dt);
        if (this.selectedId) {
          this.forge.syncEntityFromMesh(this.selectedId);
        }
      }

      this.forge.scene.render();
      this.fps.textContent = `${Math.round(this.forge.engine.getFps())} FPS`;
    });

    window.addEventListener("resize", () => this.forge.resize());
  }

  private bindUI(): void {
    must<HTMLButtonElement>("tool-move").addEventListener("click", () => this.setTool("move"));
    must<HTMLButtonElement>("tool-rotate").addEventListener("click", () => this.setTool("rotate"));
    must<HTMLButtonElement>("tool-scale").addEventListener("click", () => this.setTool("scale"));

    document.querySelectorAll<HTMLButtonElement>("[data-primitive]").forEach((button) => {
      button.addEventListener("click", () => {
        if (this.mode !== "editor") return;
        const kind = button.dataset.primitive as ForgePrimitive | undefined;
        if (!kind) return;
        this.createPrimitive(kind);
      });
    });

    must<HTMLButtonElement>("duplicate-selected").addEventListener("click", () => this.duplicateSelected());
    must<HTMLButtonElement>("delete-selected").addEventListener("click", () => this.deleteSelected());
    must<HTMLButtonElement>("undo").addEventListener("click", () => this.undo());
    must<HTMLButtonElement>("redo").addEventListener("click", () => this.redo());

    must<HTMLButtonElement>("play").addEventListener("click", () => this.enterPlayMode());
    must<HTMLButtonElement>("stop").addEventListener("click", () => this.exitPlayMode());
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
      if (event.target instanceof HTMLInputElement) return;

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

        if (!this.rightMouseNavigation) {
          if (event.code === "KeyW") this.setTool("move");
          if (event.code === "KeyE") this.setTool("rotate");
          if (event.code === "KeyR") this.setTool("scale");
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
    });
  }

  private bindEditorNavigation(): void {
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());

    this.canvas.addEventListener("pointerdown", (event) => {
      if (event.button === 2 && this.mode === "editor") {
        this.rightMouseNavigation = true;
        this.canvas.setPointerCapture?.(event.pointerId);
      }
    });

    window.addEventListener("pointerup", (event) => {
      if (event.button === 2) {
        this.rightMouseNavigation = false;
      }
    });
  }

  private updateEditorCamera(dt: number): void {
    if (!this.rightMouseNavigation) return;

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

    for (const name of ["move", "rotate", "scale"] as const) {
      must<HTMLButtonElement>(`tool-${name}`).classList.toggle("active", name === tool);
    }
  }

  private createPrimitive(kind: ForgePrimitive): void {
    this.checkpoint();
    const entity = this.forge.createPrimitive(kind);
    this.renderTree();
    this.selectEntity(entity.id);
    this.log(`Created ${entity.name}`);
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

    for (const entity of this.forge.document.entities) {
      const button = document.createElement("button");
      button.className = "scene-item";
      button.classList.toggle("selected", entity.id === this.selectedId);
      button.textContent = `◇ ${entity.name}`;
      button.title = entity.id;
      button.addEventListener("click", () => this.selectEntity(entity.id));
      this.tree.appendChild(button);
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
    must<HTMLInputElement>("scale-x").value = mesh.scaling.x.toFixed(2);
    must<HTMLInputElement>("scale-y").value = mesh.scaling.y.toFixed(2);
    must<HTMLInputElement>("scale-z").value = mesh.scaling.z.toFixed(2);

    this.componentList.replaceChildren();
    const title = document.createElement("div");
    title.textContent = "Components";
    title.style.marginBottom = "7px";
    title.style.color = "#8f9ba5";
    this.componentList.appendChild(title);

    const components = entity.components ?? {};
    const names = Object.keys(components);
    if (names.length === 0) names.push("Transform", "Mesh");

    for (const componentName of names) {
      const row = document.createElement("div");
      row.className = "component";
      row.textContent = `✓ ${componentName}`;
      this.componentList.appendChild(row);
    }
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

    this.playSnapshot = this.forge.exportDocument();
    this.mode = "play";
    this.setSelection(null);
    this.gizmos.positionGizmoEnabled = false;
    this.gizmos.rotationGizmoEnabled = false;
    this.gizmos.scaleGizmoEnabled = false;
    this.editorCamera.detachControl();
    this.editorNavKeys.clear();
    this.rightMouseNavigation = false;

    const spawn = this.forge.document.playerSpawn ?? [0, 1.1, 20];
    this.player = new PlayerController(this.forge, spawn, (message) => this.log(message));

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
    this.editorCamera.attachControl(this.canvas, true);
    this.setTool(this.tool);

    must<HTMLButtonElement>("play").disabled = false;
    must<HTMLButtonElement>("stop").disabled = true;
    this.modeBadge.textContent = "EDITOR";
    this.modeBadge.classList.remove("playing");
    this.renderTree();
    this.renderInspector();
    this.updateHistoryUI();
    this.log("Returned to editor. Runtime changes reverted.");
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

  private log(message: string): void {
    this.status.textContent = message;
  }
}
