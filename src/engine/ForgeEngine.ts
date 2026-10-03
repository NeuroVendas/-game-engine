import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { ForgeEntity, ForgePrimitive, ForgeSceneDocument } from "../types";
import { ScriptRuntime } from "./ScriptRuntime";
import { createPrefabTemplate, type ForgePrefabName } from "./prefabs";

function vec3(value: [number, number, number] | undefined, fallback: [number, number, number]): Vector3 {
  const v = value ?? fallback;
  return new Vector3(v[0], v[1], v[2]);
}

export class ForgeEngine {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly scripts: ScriptRuntime;
  document!: ForgeSceneDocument;

  private entityMeshes = new Map<string, Mesh>();

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly log: (message: string) => void
  ) {
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true
    });

    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.025, 0.035, 0.045, 1);
    this.scene.collisionsEnabled = true;

    const hemi = new HemisphericLight("forge-hemi", new Vector3(0, 1, 0), this.scene);
    hemi.intensity = 0.7;
    hemi.diffuse = new Color3(0.7, 0.8, 0.95);

    const key = new DirectionalLight("forge-key", new Vector3(-0.6, -1, 0.35), this.scene);
    key.position = new Vector3(14, 26, -12);
    key.intensity = 0.85;

    const reactorLight = new PointLight("reactor-light", new Vector3(0, 8, -8), this.scene);
    reactorLight.diffuse = new Color3(0.25, 0.8, 1);
    reactorLight.intensity = 1.8;
    reactorLight.range = 28;

    this.scripts = new ScriptRuntime(this.scene, log);
  }

  loadDocument(document: ForgeSceneDocument): void {
    for (const entityId of this.entityMeshes.keys()) {
      this.scripts.detach(entityId);
    }
    for (const mesh of this.entityMeshes.values()) {
      mesh.dispose();
    }
    this.entityMeshes.clear();

    this.document = structuredClone(document);
    for (const entity of this.document.entities) {
      this.createEntityMesh(entity);
    }

    this.log(`Loaded ${this.document.name} • ${this.document.entities.length} entities`);
  }

  createEntity(entity: ForgeEntity): Mesh {
    this.document.entities.push(entity);
    return this.createEntityMesh(entity);
  }

  addBox(): ForgeEntity {
    return this.createPrimitive("box");
  }

  createPrimitive(kind: ForgePrimitive, name?: string): ForgeEntity {
    const label = name ?? this.defaultPrimitiveName(kind);
    const id = this.makeUniqueId(label);
    const defaults: Record<ForgePrimitive, { position: [number, number, number]; size: [number, number, number]; color: string }> = {
      box: { position: [0, 1, 0], size: [2, 2, 2], color: "#6f7d88" },
      wedge: { position: [0, 1, 0], size: [2, 2, 2], color: "#71808b" },
      sphere: { position: [0, 1.25, 0], size: [2.5, 2.5, 2.5], color: "#72879a" },
      capsule: { position: [0, 1.5, 0], size: [1.5, 3, 1.5], color: "#6e7d86" },
      cylinder: { position: [0, 1.5, 0], size: [2, 3, 2], color: "#667986" },
      ground: { position: [0, 0, 0], size: [16, 1, 16], color: "#3a4147" }
    };

    const preset = defaults[kind];
    const entity: ForgeEntity = {
      id,
      name: label,
      kind,
      position: [...preset.position],
      size: [...preset.size],
      color: preset.color,
      components: {
        Collider: { enabled: true }
      }
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
    this.scripts.detach(id);
    this.entityMeshes.get(id)?.dispose();
    this.entityMeshes.delete(id);
    this.document.entities = this.document.entities.filter((entity) => entity.id !== id);
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

  private defaultPrimitiveName(kind: ForgePrimitive): string {
    const names: Record<ForgePrimitive, string> = {
      box: "Block",
      wedge: "Wedge",
      sphere: "Sphere",
      capsule: "Capsule",
      cylinder: "Cylinder",
      ground: "Ground"
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

  private createEntityMesh(entity: ForgeEntity): Mesh {
    const size = entity.size ?? [1, 1, 1];
    let mesh: Mesh;

    if (entity.kind === "wedge") {
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
    mesh.metadata = { forgeEntityId: entity.id };
    mesh.checkCollisions = entity.components?.Collider?.enabled ?? false;
    mesh.isPickable = true;

    const material = new StandardMaterial(`${entity.id}-mat`, this.scene);
    material.diffuseColor = Color3.FromHexString(entity.color ?? "#697781");
    material.roughness = 0.78;
    material.specularColor = new Color3(0.18, 0.2, 0.22);
    if (entity.emissive) {
      material.emissiveColor = Color3.FromHexString(entity.emissive);
    }
    mesh.material = material;

    this.entityMeshes.set(entity.id, mesh);
    this.scripts.attach(entity, mesh);
    return mesh;
  }
}
