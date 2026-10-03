import {
  ArcRotateCamera,
  GizmoManager,
  PointerEventTypes,
  Vector3
} from "@babylonjs/core";
import type { ForgeEntity, ForgeSceneDocument } from "../types";
import { ForgeEngine } from "../engine/ForgeEngine";
import { registerDefaultScripts } from "../engine/defaultScripts";
import { PlayerController } from "../player/PlayerController";

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
  private player: PlayerController | null = null;
  private mode: AppMode = "editor";
  private tool: ToolMode = "move";
  private selectedId: string | null = null;
  private playSnapshot: ForgeSceneDocument | null = null;

  private readonly tree = must<HTMLDivElement>("scene-tree");
  private readonly status = must<HTMLSpanElement>("status");
  private readonly fps = must<HTMLDivElement>("fps");
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
  }

  async init(): Promise<void> {
    const response = await fetch("/scenes/project-helios.forge.json");
    if (!response.ok) throw new Error(`Failed to load Project Helios scene: ${response.status}`);

    const document = await response.json() as ForgeSceneDocument;
    this.forge.loadDocument(document);
    this.renderTree();
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
      } else if (this.selectedId) {
        this.forge.syncEntityFromMesh(this.selectedId);
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

    must<HTMLButtonElement>("add-box").addEventListener("click", () => {
      if (this.mode !== "editor") return;
      const entity = this.forge.addBox();
      this.renderTree();
      this.selectEntity(entity.id);
      this.log(`Created ${entity.name}`);
    });

    must<HTMLButtonElement>("delete-selected").addEventListener("click", () => {
      if (this.mode !== "editor" || !this.selectedId) return;
      const entity = this.forge.getEntity(this.selectedId);
      this.forge.deleteEntity(this.selectedId);
      this.selectedId = null;
      this.gizmos.attachToMesh(null);
      this.renderTree();
      this.renderInspector();
      this.log(`Deleted ${entity?.name ?? "entity"}`);
    });

    must<HTMLButtonElement>("play").addEventListener("click", () => this.enterPlayMode());
    must<HTMLButtonElement>("stop").addEventListener("click", () => this.exitPlayMode());
    must<HTMLButtonElement>("export-scene").addEventListener("click", () => this.exportScene());

    const transformInputs = [
      "pos-x", "pos-y", "pos-z",
      "rot-x", "rot-y", "rot-z",
      "scale-x", "scale-y", "scale-z"
    ];

    for (const id of transformInputs) {
      must<HTMLInputElement>(id).addEventListener("change", () => this.applyInspectorTransform());
    }

    must<HTMLInputElement>("prop-name").addEventListener("change", (event) => {
      if (!this.selectedId) return;
      const entity = this.forge.getEntity(this.selectedId);
      if (!entity) return;
      entity.name = (event.target as HTMLInputElement).value.trim() || entity.name;
      this.renderTree();
      this.renderInspector();
    });

    window.addEventListener("pointerup", () => {
      if (this.mode === "editor" && this.selectedId) this.renderInspector();
    });
  }

  private bindScenePicking(): void {
    this.forge.scene.onPointerObservable.add((pointerInfo) => {
      if (this.mode !== "editor" || pointerInfo.type !== PointerEventTypes.POINTERPICK) return;
      const picked = pointerInfo.pickInfo?.pickedMesh;
      const id = picked?.metadata?.forgeEntityId as string | undefined;
      if (id) this.selectEntity(id);
    });
  }

  private bindKeyboard(): void {
    window.addEventListener("keydown", (event) => {
      if (this.mode !== "editor") return;
      if (event.target instanceof HTMLInputElement) return;

      if (event.code === "KeyW") this.setTool("move");
      if (event.code === "KeyE") this.setTool("rotate");
      if (event.code === "KeyR") this.setTool("scale");

      if (event.code === "Delete" && this.selectedId) {
        must<HTMLButtonElement>("delete-selected").click();
      }

      if (event.code === "KeyF" && this.selectedId) {
        const mesh = this.forge.getMesh(this.selectedId);
        if (mesh) {
          this.editorCamera.setTarget(mesh.getAbsolutePosition());
          this.editorCamera.radius = Math.max(4, mesh.getBoundingInfo().boundingSphere.radiusWorld * 5);
        }
      }
    });
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

  private selectEntity(id: string): void {
    if (this.mode !== "editor") return;
    const mesh = this.forge.getMesh(id);
    if (!mesh) return;

    this.selectedId = id;
    this.gizmos.attachToMesh(mesh);
    this.renderTree();
    this.renderInspector();
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
  }

  private enterPlayMode(): void {
    if (this.mode === "play") return;

    this.playSnapshot = this.forge.exportDocument();
    this.mode = "play";
    this.selectedId = null;
    this.gizmos.attachToMesh(null);
    this.gizmos.positionGizmoEnabled = false;
    this.gizmos.rotationGizmoEnabled = false;
    this.gizmos.scaleGizmoEnabled = false;
    this.editorCamera.detachControl();

    const spawn = this.forge.document.playerSpawn ?? [0, 1.1, 20];
    this.player = new PlayerController(this.forge, spawn, (message) => this.log(message));

    must<HTMLButtonElement>("play").disabled = true;
    must<HTMLButtonElement>("stop").disabled = false;
    this.modeBadge.textContent = "PLAY";
    this.modeBadge.classList.add("playing");
    this.renderTree();
    this.renderInspector();
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
