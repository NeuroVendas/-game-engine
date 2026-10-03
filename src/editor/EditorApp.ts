import {
  ArcRotateCamera,
  GizmoManager,
  PointerEventTypes,
  Vector3
} from "@babylonjs/core";
import type { ForgeComponents, ForgeEntity, ForgePrimitive, ForgeSceneDocument } from "../types";
import { ForgeEngine } from "../engine/ForgeEngine";
import { registerDefaultScripts } from "../engine/defaultScripts";
import type { ForgePrefabName } from "../engine/prefabs";
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
  private snapEnabled = true;
  private moveSnap = 1;

  private readonly tree = must<HTMLDivElement>("scene-tree");
  private readonly status = must<HTMLSpanElement>("status");
  private readonly fps = must<HTMLDivElement>("fps");
  private readonly historyState = must<HTMLDivElement>("history-state");
  private readonly modeBadge = must<HTMLDivElement>("mode-badge");
  private readonly interactionPrompt = must<HTMLDivElement>("interaction-prompt");
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
    must<HTMLButtonElement>("add-component").addEventListener("click", () => this.addSelectedComponent());
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
      case "Script":
        components.Script = { name: "console.status" };
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
        this.appendTextField(container, "Script name", component.name, (value) => {
          component.name = value;
        });
        break;
      }
    }
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

    const spawn = this.forge.document.playerSpawn ?? [0, 1.1, 20];
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
    this.editorCamera.attachControl(this.canvas, true);
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
