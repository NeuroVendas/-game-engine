import "@babylonjs/core/Collisions/collisionCoordinator";
import "@babylonjs/core/Rendering/edgesRenderer";
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
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Sound } from "@babylonjs/core/Audio/sound";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
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
  private readonly entityLightShadows = new Map<string, ShadowGenerator>();
  private readonly entitySounds = new Map<string, Sound>();
  private readonly entityParticles = new Map<string, ParticleSystem>();
  private readonly entityAnimations = new Map<string, AnimationGroup[]>();
  private readonly entityColliderProxies = new Map<string, Mesh>();
  private readonly pendingAnimationPlays = new Map<string, string | undefined>();
  private readonly hemi: HemisphericLight;
  private readonly key: DirectionalLight;
  private readonly shadowGenerator: ShadowGenerator | null;
  private sky: Mesh;
  private skyMaterial: StandardMaterial;
  private skyTexture: DynamicTexture;
  private skyImageTexture: Texture | null = null;
  private runtimeMode = false;
  private collisionDebugEnabled = false;
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

    let shadowGenerator: ShadowGenerator | null = null;
    try {
      shadowGenerator = new ShadowGenerator(2048, this.key);
      shadowGenerator.usePercentageCloserFiltering = true;
      shadowGenerator.bias = 0.0008;
      shadowGenerator.normalBias = 0.03;
    } catch (error) {
      this.log(`Shadows unavailable on this renderer: ${error instanceof Error ? error.message : String(error)}`);
    }
    this.shadowGenerator = shadowGenerator;

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
    this.scripts.setVFXAPI({
      play: (idOrName) => {
        const id = this.resolveEntityId(idOrName);
        const particles = this.entityParticles.get(id);
        if (!particles) return false;
        particles.start();
        this.canvas.dataset.lastVfxAction = `play:${id}`;
        return true;
      },
      stop: (idOrName) => {
        const id = this.resolveEntityId(idOrName);
        const particles = this.entityParticles.get(id);
        if (!particles) return false;
        particles.stop();
        this.canvas.dataset.lastVfxAction = `stop:${id}`;
        return true;
      },
      restart: (idOrName) => {
        const id = this.resolveEntityId(idOrName);
        const particles = this.entityParticles.get(id);
        if (!particles) return false;
        particles.stop();
        particles.start();
        this.canvas.dataset.lastVfxAction = `restart:${id}`;
        return true;
      }
    });
    this.scripts.setAnimationAPI({
      play: (idOrName, clipName) => this.playModelAnimation(idOrName, clipName),
      stop: (idOrName, clipName) => this.stopModelAnimation(idOrName, clipName)
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

  loadDocument(document: ForgeSceneDocument, runtimeMode = false, startScripts = true): void {
    this.scripts.stopAll();
    this.runtimeMode = runtimeMode;
    this.pendingAnimationPlays.clear();

    for (const id of [...this.entityLights.keys()]) this.disposeEntityLight(id);

    for (const id of [...this.entitySounds.keys()]) this.disposeEntitySound(id);
    for (const id of [...this.entityParticles.keys()]) this.disposeEntityParticle(id);
    for (const id of [...this.entityAnimations.keys()]) this.disposeEntityAnimations(id);
    this.entityColliderProxies.clear();
    this.refreshColliderProxyDiagnostics();

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
    this.applyRenderingSettings(this.document.rendering);

    for (const entity of this.document.entities) {
      this.createEntityMesh(entity, false);
    }

    this.applyHierarchy();
    this.setCollisionDebug(this.collisionDebugEnabled);

    if (this.runtimeMode && startScripts) {
      this.startRuntimeScripts();
    }

    this.refreshUI();
    this.log(`Loaded ${this.document.name} • ${this.document.entities.length} objects`);
  }

  startRuntimeScripts(): void {
    if (!this.runtimeMode) return;

    const modules = this.document.entities.filter(
      (entity) => entity.components?.Script?.kind === "ModuleScript"
    );
    const runnable = this.document.entities.filter(
      (entity) => entity.components?.Script?.kind !== "ModuleScript"
    );

    for (const entity of [...modules, ...runnable]) {
      const mesh = this.entityMeshes.get(entity.id);
      if (mesh) this.scripts.attach(entity, mesh);
    }
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

  instantiatePrefab(templates: ForgeEntity[], parentId?: string): ForgeEntity | null {
    if (templates.length === 0) return null;

    const sourceIds = new Set(templates.map((entity) => entity.id));
    const reservedIds = new Set(this.document.entities.map((entity) => entity.id));
    const idMap = new Map<string, string>();

    const reserveId = (name: string): string => {
      const base = name
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 48) || "Entity";
      let id = base;
      let index = 2;
      while (reservedIds.has(id)) {
        id = `${base}_${index}`;
        index += 1;
      }
      reservedIds.add(id);
      return id;
    };

    for (const template of templates) {
      idMap.set(template.id, reserveId(template.name));
    }

    const clones = templates.map((template) => {
      const clone = structuredClone(template);
      const oldId = template.id;
      clone.id = idMap.get(oldId)!;

      if (template.parentId && sourceIds.has(template.parentId)) {
        clone.parentId = idMap.get(template.parentId);
      } else {
        clone.parentId = parentId;
      }

      const script = clone.components?.Script;
      if (script?.name === `custom.${oldId}`) {
        script.name = `custom.${clone.id}`;
      }
      return clone;
    });

    for (const clone of clones) this.document.entities.push(clone);
    for (const clone of clones) this.createEntityMesh(clone, this.runtimeMode);
    this.applyHierarchy();
    this.refreshUI();

    const root = clones.find((clone, index) => {
      const source = templates[index];
      return !source.parentId || !sourceIds.has(source.parentId);
    }) ?? clones[0];

    return root;
  }

  setCollisionDebug(enabled: boolean): void {
    this.collisionDebugEnabled = enabled;
    const active = enabled && !this.runtimeMode;
    let visibleCount = 0;

    for (const entity of this.document.entities) {
      const mesh = this.entityMeshes.get(entity.id);
      if (!mesh) continue;
      if (this.applyColliderDebug(entity, mesh)) visibleCount += 1;
    }

    this.canvas.dataset.collisionDebug = String(active);
    this.canvas.dataset.collisionDebugCount = String(active ? visibleCount : 0);
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
    this.disposeEntityLight(id);
    this.disposeEntitySound(id);
    this.disposeEntityParticle(id);
    this.disposeEntityAnimations(id);
    this.pendingAnimationPlays.delete(id);
    this.entityColliderProxies.delete(id);
    this.refreshColliderProxyDiagnostics();

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

  fitBoxColliderToVisual(id: string): boolean {
    const entity = this.getEntity(id);
    const root = this.getMesh(id);
    const collider = entity?.components?.Collider;
    if (!entity || !root || !collider || (collider.mode ?? "mesh") !== "box") return false;

    root.computeWorldMatrix(true);
    const inverseRoot = root.getWorldMatrix().clone();
    inverseRoot.invert();

    const candidates: AbstractMesh[] = [
      root,
      ...root.getChildMeshes(false).filter(
        (mesh) => mesh.metadata?.forgeEntityId === entity.id
          && mesh.metadata?.forgeColliderProxy !== true
      )
    ].filter((mesh) => mesh.getTotalVertices() > 0);

    if (candidates.length === 0) return false;

    let min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
    let max = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);

    for (const mesh of candidates) {
      mesh.computeWorldMatrix(true);
      const corners = mesh.getBoundingInfo().boundingBox.vectorsWorld;
      for (const corner of corners) {
        const local = Vector3.TransformCoordinates(corner, inverseRoot);
        min = Vector3.Minimize(min, local);
        max = Vector3.Maximize(max, local);
      }
    }

    const size = max.subtract(min);
    const center = min.add(max).scale(0.5);
    if (![size.x, size.y, size.z, center.x, center.y, center.z].every(Number.isFinite)) return false;

    collider.size = [
      Math.max(0.05, Math.abs(size.x)),
      Math.max(0.05, Math.abs(size.y)),
      Math.max(0.05, Math.abs(size.z))
    ];
    collider.offset = [center.x, center.y, center.z];

    this.createColliderProxy(entity, root);
    this.applyColliderDebug(entity, root);
    this.canvas.dataset.lastColliderFit = [
      entity.id,
      ...collider.size.map((value) => value.toFixed(3)),
      ...collider.offset.map((value) => value.toFixed(3))
    ].join(":");
    return true;
  }
  resetBoxCollider(id: string): boolean {
    const entity = this.getEntity(id);
    const root = this.getMesh(id);
    const collider = entity?.components?.Collider;
    if (!entity || !root || !collider || (collider.mode ?? "mesh") !== "box") return false;

    const fallbackSize = entity.size ?? [1, 1, 1];
    collider.size = [...fallbackSize];
    collider.offset = [0, 0, 0];

    this.createColliderProxy(entity, root);
    this.applyColliderDebug(entity, root);
    this.canvas.dataset.lastColliderReset = entity.id;
    return true;
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
      mesh.setParent(null, true);
      this.syncEntityFromMesh(id);
      return true;
    }

    const parent = this.getMesh(parentId);
    if (!parent || parentId === id) return false;

    entity.parentId = parentId;
    mesh.setParent(parent, true);
    this.syncEntityFromMesh(id);
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
    this.shadowGenerator?.addShadowCaster(mesh, descendants);
    for (const generator of this.entityLightShadows.values()) {
      generator.addShadowCaster(mesh, descendants);
    }
  }

  unregisterShadowCaster(mesh: AbstractMesh, descendants = true): void {
    this.shadowGenerator?.removeShadowCaster(mesh, descendants);
    for (const generator of this.entityLightShadows.values()) {
      generator.removeShadowCaster(mesh, descendants);
    }
  }

  rebuildEntity(id: string): void {
    const entity = this.getEntity(id);
    if (!entity) return;

    this.scripts.detach(id);
    this.disposeEntityLight(id);
    this.disposeEntitySound(id);
    this.disposeEntityParticle(id);
    this.disposeEntityAnimations(id);
    this.pendingAnimationPlays.delete(id);
    this.entityColliderProxies.delete(id);
    this.refreshColliderProxyDiagnostics();

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

  applyRenderingSettings(settings = this.document?.rendering): void {
    const quality = settings?.quality ?? "medium";
    const scaling = quality === "low" ? 1.35 : quality === "high" ? 0.8 : 1;

    if (this.document) {
      this.document.rendering = { quality };
    }

    this.engine.setHardwareScalingLevel(scaling);
    this.canvas.dataset.renderQuality = quality;
    this.canvas.dataset.renderScaling = scaling.toFixed(3);
    this.resize();
  }

  applyEnvironment(environment = this.document?.environment): void {
    const next = {
      skyColor: environment?.skyColor ?? "#7fb9e8",
      skyTexture: environment?.skyTexture,
      skyTextureFileName: environment?.skyTextureFileName,
      ambientColor: environment?.ambientColor ?? "#d9e8f4",
      fogColor: environment?.fogColor ?? "#9fc6df",
      fogDensity: environment?.fogDensity ?? 0,
      exposure: Math.min(3, Math.max(0.25, environment?.exposure ?? 1)),
      contrast: Math.min(2, Math.max(0.5, environment?.contrast ?? 1)),
      toneMapping: environment?.toneMapping === "aces" ? "aces" as const : "standard" as const
    };

    if (this.document) this.document.environment = { ...next };

    const sky = safeColor(next.skyColor, "#7fb9e8");
    const ambient = safeColor(next.ambientColor, "#d9e8f4");
    const fog = safeColor(next.fogColor, "#9fc6df");

    this.skyMaterial.emissiveColor = Color3.White();

    this.skyImageTexture?.dispose();
    this.skyImageTexture = null;

    if (next.skyTexture?.trim()) {
      try {
        const image = new Texture(next.skyTexture, this.scene, false, true);
        image.uScale = -1;
        this.skyImageTexture = image;
        this.skyMaterial.emissiveTexture = image;
        this.skyMaterial.diffuseTexture = image;
        this.canvas.dataset.skyTexture = next.skyTextureFileName || "custom";
      } catch (error) {
        this.log(`Sky texture failed: ${error instanceof Error ? error.message : String(error)}`);
        this.skyMaterial.emissiveTexture = this.skyTexture;
        this.skyMaterial.diffuseTexture = this.skyTexture;
        delete this.canvas.dataset.skyTexture;
      }
    } else {
      const skyContext = this.skyTexture.getContext();
      const gradient = skyContext.createLinearGradient(0, 0, 0, 512);
      gradient.addColorStop(0, next.skyColor);
      gradient.addColorStop(0.62, next.skyColor);
      gradient.addColorStop(1, next.fogColor);
      skyContext.fillStyle = gradient;
      skyContext.fillRect(0, 0, 16, 512);
      this.skyTexture.update(false);
      this.skyMaterial.emissiveTexture = this.skyTexture;
      this.skyMaterial.diffuseTexture = this.skyTexture;
      delete this.canvas.dataset.skyTexture;
    }

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

    const image = this.scene.imageProcessingConfiguration;
    image.exposure = next.exposure;
    image.contrast = next.contrast;
    image.toneMappingEnabled = true;
    image.toneMappingType = next.toneMapping === "aces" ? 1 : 0;

    this.canvas.dataset.skybox = next.skyColor;
    this.canvas.dataset.sceneExposure = next.exposure.toFixed(3);
    this.canvas.dataset.sceneContrast = next.contrast.toFixed(3);
    this.canvas.dataset.sceneToneMapping = next.toneMapping;
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
    const collider = entity.components?.Collider;
    const usesBoxProxy = collider?.enabled === true && (collider.mode ?? "mesh") === "box";
    mesh.checkCollisions = Boolean(collider?.enabled && !usesBoxProxy);

    if (entity.kind !== "empty" && entity.kind !== "model") {
      mesh.isPickable = true;
      const material = new PBRMaterial(`${entity.id}-mat`, this.scene);
      const baseColor = safeColor(entity.color, "#8796a3");
      const preset = entity.material ?? "plastic";
      const surface = entity.surface ?? {};

      const presetSurface: Record<NonNullable<ForgeEntity["material"]>, {
        roughness: number;
        metallic: number;
      }> = {
        plastic: { roughness: 0.48, metallic: 0.02 },
        matte: { roughness: 0.94, metallic: 0 },
        metal: { roughness: 0.22, metallic: 0.88 },
        glass: { roughness: 0.08, metallic: 0 },
        neon: { roughness: 0.42, metallic: 0 }
      };
      const baseSurface = presetSurface[preset];

      material.albedoColor = baseColor;
      material.roughness = Math.min(1, Math.max(0, surface.roughness ?? baseSurface.roughness));
      material.metallic = Math.min(1, Math.max(0, surface.metallic ?? baseSurface.metallic));
      material.alpha = 1 - Math.min(1, Math.max(0, entity.transparency ?? 0));

      if (preset === "glass") {
        material.alpha = Math.min(material.alpha, 0.42);
        material.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
        material.indexOfRefraction = 1.45;
      }

      if (preset === "neon") {
        material.emissiveColor = baseColor;
        material.emissiveIntensity = 1.35;
      }

      if (entity.emissive) {
        material.emissiveColor = safeColor(entity.emissive, "#000000");
        material.emissiveIntensity = Math.max(material.emissiveIntensity, 1);
      }

      const textureScale = surface.textureScale ?? [1, 1];
      if (entity.texture?.trim()) {
        try {
          const texture = new Texture(entity.texture, this.scene, false, true);
          texture.hasAlpha = true;
          texture.uScale = Math.max(0.01, Math.abs(textureScale[0]));
          texture.vScale = Math.max(0.01, Math.abs(textureScale[1]));
          material.albedoTexture = texture;
          material.useAlphaFromAlbedoTexture = true;
        } catch (error) {
          this.log(`Texture failed on ${entity.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      mesh.metadata = {
        ...(mesh.metadata ?? {}),
        forgeSurface: {
          roughness: material.roughness,
          metallic: material.metallic,
          textureScale: [textureScale[0], textureScale[1]]
        }
      };
      this.canvas.dataset.lastSurface = [
        entity.id,
        material.roughness.toFixed(3),
        material.metallic.toFixed(3),
        Number(textureScale[0]).toFixed(3),
        Number(textureScale[1]).toFixed(3)
      ].join(":");

      mesh.material = material;
    }

    this.entityMeshes.set(entity.id, mesh);
    this.createColliderProxy(entity, mesh);
    this.applyColliderDebug(entity, mesh);

    if (entity.kind !== "empty" && entity.kind !== "model") {
      mesh.receiveShadows = true;
      if (entity.kind !== "ground") this.registerShadowCaster(mesh, false);
    }

    this.createLight(entity, mesh);
    this.createSound(entity, mesh);
    this.createParticle(entity, mesh);

    if (entity.components?.Model?.src) {
      void this.loadModel(entity, mesh);
    }

    if (attachScript) this.scripts.attach(entity, mesh);
    return mesh;
  }

  private disposeEntityLight(id: string): void {
    this.entityLightShadows.get(id)?.dispose();
    this.entityLightShadows.delete(id);
    this.entityLights.get(id)?.dispose();
    this.entityLights.delete(id);
    this.refreshLightDiagnostics();
  }

  private refreshLightDiagnostics(): void {
    this.canvas.dataset.localLights = String(this.entityLights.size);
    this.canvas.dataset.localShadowLights = String(this.entityLightShadows.size);
    this.canvas.dataset.localShadowLightIds = [...this.entityLightShadows.keys()].join(",");
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

    if (component.castShadows) {
      const mapSize = component.shadowQuality === "high"
        ? 2048
        : component.shadowQuality === "low"
          ? 512
          : 1024;
      try {
        const generator = new ShadowGenerator(mapSize, light);
        generator.usePercentageCloserFiltering = true;
        generator.bias = 0.001;
        generator.normalBias = 0.035;

        for (const candidate of this.entityMeshes.values()) {
          if (candidate.name === "__forge-sky" || candidate === mesh) continue;
          generator.addShadowCaster(candidate, true);
        }

        this.entityLightShadows.set(entity.id, generator);
      } catch (error) {
        this.log(
          `Local shadows failed on ${entity.name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    this.refreshLightDiagnostics();
  }

  private disposeEntitySound(id: string): void {
    const sound = this.entitySounds.get(id);
    if (!sound) return;

    this.entitySounds.delete(id);
    try {
      sound.stop();
    } catch {
      // Audio backends can be absent or partially initialized in preview/headless contexts.
    }

    try {
      sound.dispose();
    } catch (error) {
      this.log(`Sound cleanup fallback on ${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private createSound(entity: ForgeEntity, mesh: Mesh): void {
    const component = entity.components?.Sound;
    if (!this.runtimeMode || !component?.src?.trim()) return;

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

  private disposeEntityParticle(id: string): void {
    const particles = this.entityParticles.get(id);
    if (!particles) return;

    this.entityParticles.delete(id);
    try {
      particles.stop();
      particles.dispose();
    } catch (error) {
      this.log(`VFX cleanup fallback on ${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
    this.refreshParticleDiagnostics();
  }

  private createParticle(entity: ForgeEntity, mesh: Mesh): void {
    const component = entity.components?.Particle;
    if (!component || component.enabled === false) return;

    try {
      const capacity = Math.max(16, Math.min(5000, Math.round(component.capacity ?? 400)));
      const particles = new ParticleSystem(`${entity.id}-particles`, capacity, this.scene);
      const texture = new DynamicTexture(
        `${entity.id}-particle-texture`,
        { width: 32, height: 32 },
        this.scene,
        false
      );
      const context = texture.getContext();
      context.clearRect(0, 0, 32, 32);
      const gradient = context.createRadialGradient(16, 16, 1, 16, 16, 15);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.5, "rgba(255,255,255,0.85)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 32, 32);
      texture.hasAlpha = true;
      texture.update(false);

      const colorA = safeColor(component.color, "#b7f34a");
      const colorB = safeColor(component.color2, "#5ed0ff");
      const preset = component.preset ?? "energy";
      const lifetime = Math.max(0.05, component.lifetime ?? (preset === "smoke" ? 2.6 : 1.1));
      const size = Math.max(0.02, component.size ?? (preset === "smoke" ? 0.7 : 0.28));
      const speed = Math.max(0, component.speed ?? (preset === "sparks" ? 5 : preset === "smoke" ? 0.65 : 1.8));

      particles.particleTexture = texture;
      particles.emitter = mesh;
      particles.color1 = new Color4(colorA.r, colorA.g, colorA.b, preset === "smoke" ? 0.42 : 1);
      particles.color2 = new Color4(colorB.r, colorB.g, colorB.b, preset === "smoke" ? 0.25 : 0.8);
      particles.colorDead = new Color4(colorB.r, colorB.g, colorB.b, 0);
      particles.emitRate = Math.max(0, component.emitRate ?? (preset === "sparks" ? 85 : preset === "smoke" ? 26 : 55));
      particles.minLifeTime = lifetime * 0.65;
      particles.maxLifeTime = lifetime * 1.35;
      particles.minSize = size * 0.55;
      particles.maxSize = size * 1.45;
      particles.minEmitPower = speed * 0.55;
      particles.maxEmitPower = Math.max(speed * 1.25, particles.minEmitPower);
      particles.updateSpeed = 0.012;

      if (preset === "sparks") {
        particles.direction1 = new Vector3(-0.8, 0.7, -0.8);
        particles.direction2 = new Vector3(0.8, 2.1, 0.8);
        particles.gravity = new Vector3(0, -7.5, 0);
        particles.blendMode = ParticleSystem.BLENDMODE_ADD;
      } else if (preset === "smoke") {
        particles.direction1 = new Vector3(-0.25, 0.7, -0.25);
        particles.direction2 = new Vector3(0.25, 1.4, 0.25);
        particles.gravity = new Vector3(0, 0.08, 0);
        particles.blendMode = ParticleSystem.BLENDMODE_STANDARD;
      } else {
        particles.direction1 = new Vector3(-0.8, -0.1, -0.8);
        particles.direction2 = new Vector3(0.8, 1.5, 0.8);
        particles.gravity = Vector3.Zero();
        particles.blendMode = ParticleSystem.BLENDMODE_ADD;
      }

      this.entityParticles.set(entity.id, particles);
      if (!this.runtimeMode || component.autoplay !== false) particles.start();
      this.refreshParticleDiagnostics();
    } catch (error) {
      this.log(`VFX failed on ${entity.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private refreshParticleDiagnostics(): void {
    this.canvas.dataset.particleSystems = String(this.entityParticles.size);
    const presets = [...this.entityParticles.keys()]
      .map((id) => this.getEntity(id)?.components?.Particle?.preset ?? "energy")
      .join(",");
    this.canvas.dataset.particlePresets = presets;
  }

  private async loadModel(entity: ForgeEntity, root: Mesh): Promise<void> {
    const component = entity.components?.Model;
    const source = component?.src?.trim();
    if (!component || !source) return;

    try {
      const result = await SceneLoader.ImportMeshAsync(
        "",
        "",
        source,
        this.scene,
        undefined,
        source.startsWith("data:") ? ".glb" : undefined
      );

      for (const group of result.animationGroups) group.stop();

      if (root.isDisposed()) {
        for (const group of result.animationGroups) group.dispose();
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
        imported.checkCollisions = Boolean(
          entity.components?.Collider?.enabled
          && (entity.components.Collider.mode ?? "mesh") !== "box"
        );
        imported.receiveShadows = true;
        this.registerShadowCaster(imported, false);
        if (!imported.parent) imported.parent = root;
      }

      if (result.animationGroups.length > 0) {
        this.entityAnimations.set(entity.id, result.animationGroups);
      } else {
        this.entityAnimations.delete(entity.id);
      }

      const animationClips = result.animationGroups.map((group) => group.name);
      root.metadata = {
        ...(root.metadata ?? {}),
        modelLoaded: true,
        modelMeshCount: result.meshes.length,
        modelAnimationClips: animationClips
      };

      this.refreshAnimationDiagnostics();
      this.applyColliderDebug(entity, root);

      const hasPendingPlay = this.pendingAnimationPlays.has(entity.id);
      const pendingClip = this.pendingAnimationPlays.get(entity.id);
      this.pendingAnimationPlays.delete(entity.id);

      if (this.runtimeMode && hasPendingPlay) {
        this.playModelAnimation(entity.id, pendingClip);
      } else if (this.runtimeMode && component.animationAutoplay === true) {
        this.playModelAnimation(entity.id, component.animation);
      }

      this.canvas.dispatchEvent(new CustomEvent("forge:model-loaded", {
        detail: {
          entityId: entity.id,
          animationClips
        }
      }));

      this.log(
        `Loaded model ${entity.name} • ${result.meshes.length} meshes • ${animationClips.length} animation clip(s)`
      );
    } catch (error) {
      this.pendingAnimationPlays.delete(entity.id);
      root.metadata = {
        ...(root.metadata ?? {}),
        modelError: error instanceof Error ? error.message : String(error)
      };
      this.log(`Model failed on ${entity.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  playModelAnimation(idOrName: string, clipName?: string): boolean {
    const id = this.resolveEntityId(idOrName);
    const entity = this.getEntity(id);
    const groups = this.entityAnimations.get(id);
    const component = entity?.components?.Model;
    if (!entity || !component) return false;

    const requested = clipName?.trim() || component.animation?.trim();
    if (!groups?.length) {
      if (!component.src?.trim()) return false;
      this.pendingAnimationPlays.set(id, requested);
      this.canvas.dataset.lastAnimationAction = `queue:${id}:${requested || "*"}`;
      return true;
    }

    const group = (requested ? groups.find((candidate) => candidate.name === requested) : undefined)
      ?? groups[0];
    if (!group) return false;

    for (const candidate of groups) {
      if (candidate !== group) candidate.stop();
    }

    const speed = Math.min(4, Math.max(0.05, Number(component.animationSpeed) || 1));
    const loop = component.animationLoop ?? true;
    group.stop();
    group.start(loop, speed);
    this.canvas.dataset.lastAnimationAction = `play:${id}:${group.name}`;
    return true;
  }

  stopModelAnimation(idOrName: string, clipName?: string): boolean {
    const id = this.resolveEntityId(idOrName);
    const entity = this.getEntity(id);
    const groups = this.entityAnimations.get(id);
    const requested = clipName?.trim();

    if (!groups?.length) {
      if (!entity?.components?.Model) return false;
      this.pendingAnimationPlays.delete(id);
      this.canvas.dataset.lastAnimationAction = `stop:${id}:${requested || "*"}`;
      return true;
    }

    const targets = requested
      ? groups.filter((group) => group.name === requested)
      : groups;
    if (targets.length === 0) return false;

    for (const group of targets) group.stop();
    this.canvas.dataset.lastAnimationAction = `stop:${id}:${requested || "*"}`;
    return true;
  }

  private disposeEntityAnimations(id: string): void {
    const groups = this.entityAnimations.get(id);
    if (!groups) return;

    for (const group of groups) {
      group.stop();
      group.dispose();
    }
    this.entityAnimations.delete(id);
    this.refreshAnimationDiagnostics();
  }

  private refreshAnimationDiagnostics(): void {
    const entries = [...this.entityAnimations.entries()];
    this.canvas.dataset.modelAnimationModels = String(entries.length);
    this.canvas.dataset.modelAnimationGroups = String(
      entries.reduce((count, [, groups]) => count + groups.length, 0)
    );
    this.canvas.dataset.modelAnimationClips = entries
      .map(([id, groups]) => `${id}:${groups.map((group) => group.name).join("|")}`)
      .join(",");
  }

  private createColliderProxy(entity: ForgeEntity, root: Mesh): void {
    const previous = this.entityColliderProxies.get(entity.id);
    previous?.dispose(false, true);
    this.entityColliderProxies.delete(entity.id);

    const collider = entity.components?.Collider;
    if (!collider?.enabled || (collider.mode ?? "mesh") !== "box") {
      this.refreshColliderProxyDiagnostics();
      return;
    }

    const fallbackSize = entity.size ?? [1, 1, 1];
    const size = collider.size ?? fallbackSize;
    const offset = collider.offset ?? [0, 0, 0];

    const proxy = MeshBuilder.CreateBox(`${entity.id}__collider`, {
      width: Math.max(0.05, Math.abs(size[0])),
      height: Math.max(0.05, Math.abs(size[1])),
      depth: Math.max(0.05, Math.abs(size[2]))
    }, this.scene);

    proxy.parent = root;
    proxy.position = new Vector3(offset[0], offset[1], offset[2]);
    proxy.isPickable = false;
    proxy.checkCollisions = true;
    proxy.visibility = 0;
    proxy.metadata = {
      forgeEntityId: entity.id,
      forgeEntityName: entity.name,
      forgeColliderProxy: true
    };

    const material = new StandardMaterial(`${entity.id}-collider-proxy-mat`, this.scene);
    material.diffuseColor = new Color3(0.32, 0.95, 0.24);
    material.emissiveColor = new Color3(0.12, 0.38, 0.08);
    material.alpha = 0.24;
    material.wireframe = true;
    material.disableLighting = true;
    proxy.material = material;

    this.entityColliderProxies.set(entity.id, proxy);
    this.refreshColliderProxyDiagnostics();
  }

  private refreshColliderProxyDiagnostics(): void {
    this.canvas.dataset.colliderProxyCount = String(this.entityColliderProxies.size);
    this.canvas.dataset.colliderProxyIds = [...this.entityColliderProxies.keys()].join(",");
  }

  private applyColliderDebug(entity: ForgeEntity, root: Mesh): boolean {
    const enabled = !this.runtimeMode
      && this.collisionDebugEnabled
      && Boolean(entity.components?.Collider?.enabled);
    const mode = entity.components?.Collider?.mode ?? "mesh";
    const proxy = this.entityColliderProxies.get(entity.id);

    if (mode === "box" && proxy) {
      proxy.visibility = enabled ? 0.32 : 0;
      if (enabled) {
        proxy.enableEdgesRendering();
        proxy.edgesWidth = 3;
        proxy.edgesColor = new Color4(0.55, 1, 0.18, 1);
      } else {
        proxy.disableEdgesRendering();
      }
      return enabled;
    }

    if (proxy) {
      proxy.visibility = 0;
      proxy.disableEdgesRendering();
    }

    const modelMeshes = root.getChildMeshes(false).filter(
      (target) => target.metadata?.forgeEntityId === entity.id
        && target.metadata?.forgeColliderProxy !== true
    );
    const targets: AbstractMesh[] = [root, ...modelMeshes];

    for (const target of targets) {
      if (enabled && target.visibility !== 0) {
        target.enableEdgesRendering();
        target.edgesWidth = 2.5;
        target.edgesColor = new Color4(0.55, 1, 0.18, 0.95);
      } else {
        target.disableEdgesRendering();
      }
    }

    return enabled && targets.some((target) => target.visibility !== 0);
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
