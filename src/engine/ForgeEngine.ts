import "@babylonjs/core/Collisions/collisionCoordinator";
import "@babylonjs/loaders/glTF";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { SpotLight } from "@babylonjs/core/Lights/spotLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import type { Light } from "@babylonjs/core/Lights/light";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Sound } from "@babylonjs/core/Audio/sound";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import type { ForgeEntity, ForgePrimitive, ForgeSceneDocument } from "../types";
import { ScriptRuntime } from "./ScriptRuntime";
import { createPrefabTemplate, type ForgePrefabName } from "./prefabs";

function vec3(value: [number, number, number] | undefined, fallback: [number, number, number]): Vector3 {
  const v = value ?? fallback;
  return new Vector3(v[0], v[1], v[2]);
}

function safeColor(value: string | undefined, fallback: string): Color3 {
  try {
    return Color3.FromHexString(value || fallback);
  } catch {
    return Color3.FromHexString(fallback);
  }
}

export class ForgeEngine {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly scripts: ScriptRuntime;
  document!: ForgeSceneDocument;

  private readonly entityMeshes = new Map<string, Mesh>();
  private readonly entityLights = new Map<string, Light>();
  private readonly entitySounds = new Map<string, Sound>();
  private readonly hemi: HemisphericLight;
  private readonly key: DirectionalLight;
  private readonly shadowGenerator: ShadowGenerator;
  private sky: Mesh;
  private skyMaterial: StandardMaterial;
  private skyTexture: DynamicTexture;
  private runtimeMode = false;
  private uiRoot: HTMLElement | null = null;
  private uiInteractive = false;

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly log: (message: string) => void
  ) {
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true
    });

    this.scene = new Scene(this.engine);
    this.scene.collisionsEnabled = true;

    this.hemi = new HemisphericLight("forge-hemi", new Vector3(0, 1, 0), this.scene);
    this.key = new DirectionalLight("forge-key", new Vector3(-0.6, -1, 0.35), this.scene);
    this.key.position = new Vector3(18, 32, -18);
    this.key.shadowMinZ = 1;
    this.key.shadowMaxZ = 160;

    this.shadowGenerator = new ShadowGenerator(2048, this.key);
    this.shadowGenerator.usePercentageCloserFiltering = true;
    this.shadowGenerator.bias = 0.0008;
    this.shadowGenerator.normalBias = 0.03;

    this.sky = MeshBuilder.CreateSphere("__forge-sky", {
      diameter: 1800,
      segments: 20
    }, this.scene);
    this.sky.isPickable = false;
    this.sky.infiniteDistance = true;
    this.sky.applyFog = false;

    this.skyMaterial = new StandardMaterial("__forge-sky-material", this.scene);
    this.skyMaterial.backFaceCulling = false;
    this.skyMaterial.disableLighting = true;
    this.skyTexture = new DynamicTexture("__forge-sky-gradient", { width: 16, height: 512 }, this.scene, false);
    this.skyMaterial.emissiveTexture = this.skyTexture;
    this.skyMaterial.diffuseTexture = this.skyTexture;
    this.sky.material = this.skyMaterial;

    this.scene.imageProcessingConfiguration.exposure = 1.05;
    this.scene.imageProcessingConfiguration.contrast = 1.06;

    this.scripts = new ScriptRuntime(this.scene, log);
    this.scripts.setAudioAPI({
      play: (idOrName) => {
        const sound = this.entitySounds.get(this.resolveEntityId(idOrName));
        if (!sound) return false;
        sound.play();
        return true;
      },
      pause: (idOrName) => {
        const sound = this.entitySounds.get(this.resolveEntityId(idOrName));
        if (!sound) return false;
        sound.pause();
        return true;
      },
      stop: (idOrName) => {
        const sound = this.entitySounds.get(this.resolveEntityId(idOrName));
        if (!sound) return false;
        sound.stop();
        return true;
      },
      setVolume: (idOrName, volume) => {
        const sound = this.entitySounds.get(this.resolveEntityId(idOrName));
        if (!sound) return false;
        sound.setVolume(Math.min(1, Math.max(0, Number(volume) || 0)));
        return true;
      }
    });
    this.scripts.setUIAPI({
      setText: (idOrName, text) => {
        const entity = this.getEntity(this.resolveEntityId(idOrName));
        if (!entity?.components?.UI) return false;
        entity.components.UI.text = String(text);
        this.refreshUI();
        return true;
      },
      show: (idOrName, visible) => {
        const entity = this.getEntity(this.resolveEntityId(idOrName));
        if (!entity?.components?.UI) return false;
        entity.components.UI.visible = Boolean(visible);
        this.refreshUI();
        return true;
      }
    });
    this.scripts.setWorldMutationAPI({
      create: (kind, name) => {
        if (!this.runtimeMode) return null;
        const entity = this.createPrimitive(kind, name);
        return entity.id;
      },
      clone: (idOrName) => {
        if (!this.runtimeMode) return null;
        const sourceId = this.resolveEntityId(idOrName);
        const clone = this.duplicateEntity(sourceId);
        return clone?.id ?? null;
      },
      destroy: (idOrName) => {
        if (!this.runtimeMode) return false;
        const id = this.resolveEntityId(idOrName);
        if (!this.getEntity(id)) return false;
        this.deleteEntity(id);
        return true;
      }
    });
    this.applyEnvironment();
  }

  loadDocument(document: ForgeSceneDocument, runtimeMode = false): void {
    this.scripts.stopAll();
    this.runtimeMode = runtimeMode;

    for (const light of this.entityLights.values()) light.dispose();
    this.entityLights.clear();

    for (const sound of this.entitySounds.values()) sound.dispose();
    this.entitySounds.clear();

    // Detach Forge entity roots first so disposing one parent cannot accidentally
    // dispose another tracked Forge entity before its own cleanup pass.
    for (const mesh of this.entityMeshes.values()) {
      mesh.parent = null;
    }
    for (const mesh of this.entityMeshes.values()) {
      mesh.dispose(false, true);
    }
    this.entityMeshes.clear();

    this.document = structuredClone(document);
    this.applyEnvironment(this.document.environment);

    for (const entity of this.document.entities) {
      this.createEntityMesh(entity, false);
    }

    this.applyHierarchy();

    if (this.runtimeMode) {
      const modules = this.document.entities.filter((entity) => entity.components?.Script?.kind === "ModuleScript");
      const runnable = this.document.entities.filter((entity) => entity.components?.Script?.kind !== "ModuleScript");

      for (const entity of [...modules, ...runnable]) {
        const mesh = this.entityMeshes.get(entity.id);
        if (mesh) this.scripts.attach(entity, mesh);
      }
    }

    this.refreshUI();
    this.log(`Loaded ${this.document.name} • ${this.document.entities.length} objects`);
  }

  createEntity(entity: ForgeEntity): Mesh {
    this.document.entities.push(entity);
    const mesh = this.createEntityMesh(entity, this.runtimeMode);
    this.applyParent(entity, mesh);
    this.refreshUI();
    return mesh;
  }

  addBox(): ForgeEntity {
    return this.createPrimitive("box");
  }

  createPrimitive(kind: ForgePrimitive, name?: string): ForgeEntity {
    const label = name ?? this.defaultPrimitiveName(kind);
    const id = this.makeUniqueId(label);
    const defaults: Record<ForgePrimitive, {
      position: [number, number, number];
      size: [number, number, number];
      color: string;
    }> = {
      box: { position: [0, 1, 0], size: [2, 2, 2], color: "#8796a3" },
      wedge: { position: [0, 1, 0], size: [2, 2, 2], color: "#8796a3" },
      sphere: { position: [0, 1.25, 0], size: [2.5, 2.5, 2.5], color: "#8796a3" },
      capsule: { position: [0, 1.5, 0], size: [1.5, 3, 1.5], color: "#8796a3" },
      cylinder: { position: [0, 1.5, 0], size: [2, 3, 2], color: "#8796a3" },
      ground: { position: [0, 0, 0], size: [16, 1, 16], color: "#5e7f4f" },
      empty: { position: [0, 0, 0], size: [1, 1, 1], color: "#8796a3" },
      model: { position: [0, 0, 0], size: [1, 1, 1], color: "#8796a3" }
    };

    const preset = defaults[kind];
    const entity: ForgeEntity = {
      id,
      name: label,
      kind,
      position: [...preset.position],
      size: [...preset.size],
      color: preset.color,
      components: kind === "empty" || kind === "model"
        ? {}
        : { Collider: { enabled: true } }
    };

    this.createEntity(entity);
    return entity;
  }

  createPrefab(prefab: ForgePrefabName): ForgeEntity {
    const template = createPrefabTemplate(prefab);
    const entity: ForgeEntity = {
      ...structuredClone(template),
      id: this.makeUniqueId(template.name)
    };
    this.createEntity(entity);
    return entity;
  }

  duplicateEntity(id: string): ForgeEntity | null {
    const source = this.getEntity(id);
    if (!source) return null;

    const copy = structuredClone(source);
    copy.id = this.makeUniqueId(`${source.name}_Copy`);
    copy.name = `${source.name} Copy`;
    copy.position = [
      source.position[0] + 2,
      source.position[1],
      source.position[2] + 2
    ];

    this.createEntity(copy);
    return copy;
  }

  deleteEntity(id: string): void {
    const children = this.document.entities
      .filter((entity) => entity.parentId === id)
      .map((entity) => entity.id);

    for (const childId of children) this.deleteEntity(childId);

    this.scripts.detach(id);
    this.entityLights.get(id)?.dispose();
    this.entityLights.delete(id);
    this.entitySounds.get(id)?.dispose();
    this.entitySounds.delete(id);

    const oldMesh = this.entityMeshes.get(id);
    if (oldMesh) this.unregisterShadowCaster(oldMesh, true);
    oldMesh?.dispose(false, true);
    this.entityMeshes.delete(id);
    this.document.entities = this.document.entities.filter((entity) => entity.id !== id);
    this.refreshUI();
  }

  getEntity(id: string): ForgeEntity | undefined {
    return this.document.entities.find((entity) => entity.id === id);
  }

  getMesh(id: string): Mesh | undefined {
    return this.entityMeshes.get(id);
  }

  syncEntityFromMesh(id: string): void {
    const entity = this.getEntity(id);
    const mesh = this.getMesh(id);
    if (!entity || !mesh) return;

    entity.position = [mesh.position.x, mesh.position.y, mesh.position.z];
    entity.rotation = [
      mesh.rotation.x * 180 / Math.PI,
      mesh.rotation.y * 180 / Math.PI,
      mesh.rotation.z * 180 / Math.PI
    ];
    entity.scale = [mesh.scaling.x, mesh.scaling.y, mesh.scaling.z];
  }

  exportDocument(): ForgeSceneDocument {
    for (const entity of this.document.entities) {
      this.syncEntityFromMesh(entity.id);
    }
    return structuredClone(this.document);
  }

  resize(): void {
    this.engine.resize();
  }

  setEntityParent(id: string, parentId?: string): boolean {
    const entity = this.getEntity(id);
    const mesh = this.getMesh(id);
    if (!entity || !mesh) return false;

    if (!parentId) {
      entity.parentId = undefined;
      mesh.parent = null;
      return true;
    }

    const parent = this.getMesh(parentId);
    if (!parent || parentId === id) return false;

    entity.parentId = parentId;
    mesh.parent = parent;
    return true;
  }

  getPlayerSpawn(fallback: [number, number, number]): [number, number, number] {
    const spawn = this.document.entities.find((entity) => entity.components?.Spawn?.enabled);
    if (!spawn) return this.document.playerSpawn ?? fallback;

    const mesh = this.getMesh(spawn.id);
    const position = mesh?.getAbsolutePosition() ?? vec3(spawn.position, fallback);
    return [position.x, position.y + 1.65, position.z];
  }

  registerShadowCaster(mesh: AbstractMesh, descendants = true): void {
    if (mesh.name === "__forge-sky") return;
    mesh.receiveShadows = true;
    this.shadowGenerator.addShadowCaster(mesh, descendants);
  }

  unregisterShadowCaster(mesh: AbstractMesh, descendants = true): void {
    this.shadowGenerator.removeShadowCaster(mesh, descendants);
  }

  rebuildEntity(id: string): void {
    const entity = this.getEntity(id);
    if (!entity) return;

    this.scripts.detach(id);
    this.entityLights.get(id)?.dispose();
    this.entityLights.delete(id);
    this.entitySounds.get(id)?.dispose();
    this.entitySounds.delete(id);

    const forgeChildren = this.document.entities
      .filter((candidate) => candidate.parentId === id)
      .map((candidate) => this.entityMeshes.get(candidate.id))
      .filter((mesh): mesh is Mesh => Boolean(mesh));

    for (const childMesh of forgeChildren) childMesh.parent = null;

    const oldMesh = this.entityMeshes.get(id);
    if (oldMesh) this.unregisterShadowCaster(oldMesh, true);
    oldMesh?.dispose(false, true);
    this.entityMeshes.delete(id);

    const mesh = this.createEntityMesh(entity, this.runtimeMode);
    this.applyParent(entity, mesh);

    for (const child of this.document.entities.filter((candidate) => candidate.parentId === id)) {
      const childMesh = this.entityMeshes.get(child.id);
      if (childMesh) this.applyParent(child, childMesh);
    }

    this.refreshUI();
  }

  applyEnvironment(environment = this.document?.environment): void {
    const next = {
      skyColor: environment?.skyColor ?? "#7fb9e8",
      ambientColor: environment?.ambientColor ?? "#d9e8f4",
      fogColor: environment?.fogColor ?? "#9fc6df",
      fogDensity: environment?.fogDensity ?? 0
    };

    if (this.document) this.document.environment = { ...next };

    const sky = safeColor(next.skyColor, "#7fb9e8");
    const ambient = safeColor(next.ambientColor, "#d9e8f4");
    const fog = safeColor(next.fogColor, "#9fc6df");

    this.skyMaterial.emissiveColor = Color3.White();
    const skyContext = this.skyTexture.getContext();
    const gradient = skyContext.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, next.skyColor);
    gradient.addColorStop(0.62, next.skyColor);
    gradient.addColorStop(1, next.fogColor);
    skyContext.fillStyle = gradient;
    skyContext.fillRect(0, 0, 16, 512);
    this.skyTexture.update(false);

    this.scene.clearColor = new Color4(sky.r, sky.g, sky.b, 1);

    this.hemi.diffuse = ambient;
    this.hemi.groundColor = ambient.scale(0.45);
    this.hemi.intensity = 0.92;

    this.key.diffuse = new Color3(1, 0.96, 0.88);
    this.key.intensity = 0.72;

    if (next.fogDensity > 0) {
      this.scene.fogMode = Scene.FOGMODE_EXP2;
      this.scene.fogDensity = Math.min(0.1, Math.max(0, next.fogDensity));
      this.scene.fogColor = fog;
    } else {
      this.scene.fogMode = Scene.FOGMODE_NONE;
    }

    this.canvas.dataset.skybox = next.skyColor;
  }

  mountUI(root: HTMLElement, interactive: boolean): void {
    this.uiRoot = root;
    this.uiInteractive = interactive;
    this.refreshUI();
  }

  refreshUI(): void {
    if (!this.uiRoot || !this.document) return;

    this.uiRoot.replaceChildren();
    this.uiRoot.classList.toggle("interactive", this.uiInteractive);

    for (const entity of this.document.entities) {
      const ui = entity.components?.UI;
      if (!ui || ui.visible === false) continue;

      const element = document.createElement(ui.type === "button" ? "button" : "div");
      element.className = `forge-runtime-ui forge-ui-${ui.type}`;
      element.dataset.entityId = entity.id;
      element.textContent = ui.text ?? (ui.type === "button" ? "Button" : "Text");

      element.style.width = `${Math.max(1, ui.width ?? (ui.type === "panel" ? 260 : 180))}px`;
      element.style.height = `${Math.max(1, ui.height ?? (ui.type === "panel" ? 120 : 38))}px`;
      element.style.color = ui.color ?? "#ffffff";
      element.style.background = ui.background ?? (ui.type === "panel" ? "#1b2733cc" : ui.type === "button" ? "#dfe8ee" : "transparent");
      element.style.fontSize = `${Math.max(8, ui.fontSize ?? 18)}px`;

      const x = ui.x ?? 16;
      const y = ui.y ?? 16;
      const anchor = ui.anchor ?? "top-left";

      if (anchor === "top-center") {
        element.style.left = `calc(50% + ${x}px)`;
        element.style.top = `${y}px`;
        element.style.transform = "translateX(-50%)";
      } else if (anchor === "center") {
        element.style.left = `calc(50% + ${x}px)`;
        element.style.top = `calc(50% + ${y}px)`;
        element.style.transform = "translate(-50%, -50%)";
      } else if (anchor === "bottom-center") {
        element.style.left = `calc(50% + ${x}px)`;
        element.style.bottom = `${y}px`;
        element.style.transform = "translateX(-50%)";
      } else {
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
      }

      if (ui.type === "button") {
        const button = element as HTMLButtonElement;
        button.disabled = !this.uiInteractive;
        if (this.uiInteractive) {
          button.addEventListener("click", () => {
            this.scripts.uiClick(entity.id);
            for (const child of this.document.entities.filter((candidate) => candidate.parentId === entity.id)) {
              this.scripts.uiClick(child.id);
            }
          });
        }
      }

      this.uiRoot.appendChild(element);
    }
  }

  private resolveEntityId(idOrName: string): string {
    const direct = this.getEntity(idOrName);
    if (direct) return direct.id;

    const byName = this.document?.entities.find((entity) => entity.name === idOrName);
    return byName?.id ?? idOrName;
  }

  private defaultPrimitiveName(kind: ForgePrimitive): string {
    const names: Record<ForgePrimitive, string> = {
      box: "Block",
      wedge: "Wedge",
      sphere: "Sphere",
      capsule: "Capsule",
      cylinder: "Cylinder",
      ground: "Ground",
      empty: "Object",
      model: "Model"
    };
    return names[kind];
  }

  private makeUniqueId(name: string): string {
    const base = name
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48) || "Entity";

    let id = base;
    let index = 2;
    while (this.getEntity(id)) {
      id = `${base}_${index}`;
      index += 1;
    }
    return id;
  }

  private createEntityMesh(entity: ForgeEntity, attachScript = this.runtimeMode): Mesh {
    const size = entity.size ?? [1, 1, 1];
    let mesh: Mesh;

    if (entity.kind === "empty" || entity.kind === "model") {
      mesh = new Mesh(entity.id, this.scene);
      mesh.visibility = 0;
      mesh.isPickable = false;
    } else if (entity.kind === "wedge") {
      mesh = new Mesh(entity.id, this.scene);

      const width = size[0];
      const height = size[1];
      const depth = size[2];

      const positions = [
        -width / 2, -height / 2, -depth / 2,
         width / 2, -height / 2, -depth / 2,
        -width / 2, -height / 2,  depth / 2,
         width / 2, -height / 2,  depth / 2,
        -width / 2,  height / 2,  depth / 2,
         width / 2,  height / 2,  depth / 2
      ];

      const indices = [
        0, 2, 3, 0, 3, 1,
        2, 4, 5, 2, 5, 3,
        0, 4, 2,
        1, 3, 5,
        0, 1, 5, 0, 5, 4
      ];

      const normals: number[] = [];
      VertexData.ComputeNormals(positions, indices, normals);

      const data = new VertexData();
      data.positions = positions;
      data.indices = indices;
      data.normals = normals;
      data.applyToMesh(mesh);
    } else if (entity.kind === "sphere") {
      mesh = MeshBuilder.CreateSphere(entity.id, {
        diameterX: size[0],
        diameterY: size[1] || size[0],
        diameterZ: size[2] || size[0],
        segments: 24
      }, this.scene);
    } else if (entity.kind === "capsule") {
      mesh = MeshBuilder.CreateCapsule(entity.id, {
        radius: size[0] / 2,
        height: size[1],
        subdivisions: 16
      }, this.scene);
    } else if (entity.kind === "cylinder") {
      mesh = MeshBuilder.CreateCylinder(entity.id, {
        diameter: size[0],
        height: size[1],
        tessellation: 24
      }, this.scene);
      mesh.scaling.z = size[2] / Math.max(size[0], 0.0001);
    } else if (entity.kind === "ground") {
      mesh = MeshBuilder.CreateGround(entity.id, {
        width: size[0],
        height: size[2] || size[0],
        subdivisions: 2
      }, this.scene);
    } else {
      mesh = MeshBuilder.CreateBox(entity.id, {
        width: size[0],
        height: size[1],
        depth: size[2]
      }, this.scene);
    }

    mesh.position = vec3(entity.position, [0, 0, 0]);
    mesh.rotation = vec3(entity.rotation, [0, 0, 0]).scale(Math.PI / 180);
    mesh.scaling = vec3(entity.scale, [1, 1, 1]);
    mesh.metadata = { forgeEntityId: entity.id, forgeEntityName: entity.name };
    mesh.checkCollisions = entity.components?.Collider?.enabled ?? false;

    if (entity.kind !== "empty" && entity.kind !== "model") {
      mesh.isPickable = true;
      const material = new StandardMaterial(`${entity.id}-mat`, this.scene);
      material.diffuseColor = safeColor(entity.color, "#8796a3");
      material.roughness = 0.72;
      material.specularColor = new Color3(0.12, 0.14, 0.16);
      material.alpha = 1 - Math.min(1, Math.max(0, entity.transparency ?? 0));
      if (entity.emissive) material.emissiveColor = safeColor(entity.emissive, "#000000");
      if (entity.texture?.trim()) {
        try {
          const texture = new Texture(entity.texture, this.scene, false, true);
          texture.hasAlpha = true;
          material.diffuseTexture = texture;
          material.useAlphaFromDiffuseTexture = true;
        } catch (error) {
          this.log(`Texture failed on ${entity.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      mesh.material = material;
    }

    this.entityMeshes.set(entity.id, mesh);

    if (entity.kind !== "empty" && entity.kind !== "model") {
      mesh.receiveShadows = true;
      if (entity.kind !== "ground") this.registerShadowCaster(mesh, false);
    }

    this.createLight(entity, mesh);
    this.createSound(entity, mesh);

    if (entity.components?.Model?.src) {
      void this.loadModel(entity, mesh);
    }

    if (attachScript) this.scripts.attach(entity, mesh);
    return mesh;
  }

  private createLight(entity: ForgeEntity, mesh: Mesh): void {
    const component = entity.components?.Light;
    if (!component) return;

    let light: PointLight | SpotLight;
    if (component.type === "spot") {
      light = new SpotLight(
        `${entity.id}-light`,
        Vector3.Zero(),
        new Vector3(0, -1, 0),
        component.angle ?? Math.PI / 3,
        2,
        this.scene
      );
    } else {
      light = new PointLight(`${entity.id}-light`, Vector3.Zero(), this.scene);
    }

    light.parent = mesh;
    light.diffuse = safeColor(component.color, "#ffffff");
    light.intensity = component.intensity ?? 1;
    light.range = component.range ?? 18;
    this.entityLights.set(entity.id, light);
  }

  private createSound(entity: ForgeEntity, mesh: Mesh): void {
    const component = entity.components?.Sound;
    if (!component?.src?.trim()) return;

    try {
      const sound = new Sound(
        `${entity.id}-sound`,
        component.src,
        this.scene,
        undefined,
        {
          autoplay: this.runtimeMode && (component.autoplay ?? false),
          loop: component.loop ?? false,
          volume: Math.min(1, Math.max(0, component.volume ?? 1)),
          spatialSound: component.spatial ?? true,
          maxDistance: component.maxDistance ?? 40
        }
      );

      if (component.spatial ?? true) sound.attachToMesh(mesh);
      this.entitySounds.set(entity.id, sound);
    } catch (error) {
      this.log(`Sound failed on ${entity.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async loadModel(entity: ForgeEntity, root: Mesh): Promise<void> {
    const source = entity.components?.Model?.src?.trim();
    if (!source) return;

    try {
      const result = await SceneLoader.ImportMeshAsync(
        "",
        "",
        source,
        this.scene,
        undefined,
        source.startsWith("data:") ? ".glb" : undefined
      );

      if (root.isDisposed()) {
        for (const imported of result.meshes) imported.dispose(false, true);
        return;
      }

      for (const imported of result.meshes) {
        imported.metadata = {
          ...(imported.metadata ?? {}),
          forgeEntityId: entity.id,
          forgeEntityName: entity.name
        };
        imported.isPickable = true;
        imported.checkCollisions = entity.components?.Collider?.enabled ?? false;
        imported.receiveShadows = true;
        this.registerShadowCaster(imported, false);
        if (!imported.parent) imported.parent = root;
      }

      root.metadata = {
        ...(root.metadata ?? {}),
        modelLoaded: true,
        modelMeshCount: result.meshes.length
      };
      this.log(`Loaded model ${entity.name} • ${result.meshes.length} meshes`);
    } catch (error) {
      root.metadata = {
        ...(root.metadata ?? {}),
        modelError: error instanceof Error ? error.message : String(error)
      };
      this.log(`Model failed on ${entity.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private applyHierarchy(): void {
    for (const entity of this.document.entities) {
      const mesh = this.entityMeshes.get(entity.id);
      if (mesh) this.applyParent(entity, mesh);
    }
  }

  private applyParent(entity: ForgeEntity, mesh: Mesh): void {
    if (!entity.parentId) {
      mesh.parent = null;
      return;
    }

    const parent = this.entityMeshes.get(entity.parentId);
    mesh.parent = parent ?? null;
  }
}
