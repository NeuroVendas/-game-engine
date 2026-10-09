export type Vec3 = [number, number, number];

export type ForgePrimitive = "box" | "wedge" | "sphere" | "capsule" | "cylinder" | "ground" | "empty" | "model";

export type ForgeScriptKind = "Script" | "LocalScript" | "ModuleScript";

export interface ForgeComponents {
  Collider?: {
    enabled: boolean;
    mode?: "mesh" | "box";
    size?: [number, number, number];
    offset?: [number, number, number];
  };
  Trigger?: {
    enabled: boolean;
    size?: [number, number, number];
    offset?: [number, number, number];
  };
  Hazard?: {
    enabled: boolean;
    damage?: number;
    interval?: number;
  };
  Interactable?: {
    enabled: boolean;
    prompt?: string;
  };
  Door?: {
    openHeight?: number;
  };
  Clearance?: {
    level: number;
  };
  PowerConsumer?: {
    bus: string;
    draw?: number;
    required?: boolean;
  };
  Reactor?: {
    power?: number;
    temperature?: number;
  };
  Script?: {
    name: string;
    kind?: ForgeScriptKind;
    enabled?: boolean;
    source?: string;
  };
  Light?: {
    type: "point" | "spot";
    color?: string;
    intensity?: number;
    range?: number;
    angle?: number;
  };
  Sound?: {
    src: string;
    fileName?: string;
    volume?: number;
    loop?: boolean;
    autoplay?: boolean;
    spatial?: boolean;
    maxDistance?: number;
  };
  Particle?: {
    enabled?: boolean;
    preset?: "energy" | "sparks" | "smoke";
    color?: string;
    color2?: string;
    emitRate?: number;
    capacity?: number;
    lifetime?: number;
    size?: number;
    speed?: number;
    autoplay?: boolean;
  };
  UI?: {
    type: "text" | "button" | "panel";
    text?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    fontSize?: number;
    color?: string;
    background?: string;
    visible?: boolean;
    anchor?: "top-left" | "top-center" | "center" | "bottom-center";
  };
  Model?: {
    src: string;
    fileName?: string;
    animation?: string;
    animationAutoplay?: boolean;
    animationLoop?: boolean;
    animationSpeed?: number;
  };
  Spawn?: {
    enabled: boolean;
  };
}

export interface ForgeEntity {
  id: string;
  name: string;
  kind: ForgePrimitive;
  position: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  size?: Vec3;
  color?: string;
  material?: "plastic" | "matte" | "metal" | "glass" | "neon";
  emissive?: string;
  transparency?: number;
  texture?: string;
  textureFileName?: string;
  components?: ForgeComponents;
  parentId?: string;
}

export interface ForgePrefabDocument {
  format: "forge.prefab";
  version: 1;
  name: string;
  entities: ForgeEntity[];
}

export interface ForgeSceneDocument {
  format: "forge.scene";
  version: 1;
  name: string;
  playerSpawn?: Vec3;
  player?: {
    colliderHeight?: number;
    colliderRadius?: number;
    walkSpeed?: number;
    runSpeed?: number;
    jumpPower?: number;
    maxHealth?: number;
    autoRespawn?: boolean;
    killY?: number;
  };
  prefabs?: ForgePrefabDocument[];
  environment?: {
    skyColor?: string;
    skyTexture?: string;
    skyTextureFileName?: string;
    ambientColor?: string;
    fogColor?: string;
    fogDensity?: number;
  };
  entities: ForgeEntity[];
  platform?: {
    cloudId?: string;
    slug?: string;
    visibility?: "private" | "unlisted" | "public";
    ownerId?: string;
    ownerUsername?: string;
    ownerDisplayName?: string;
    description?: string;
    updatedAt?: string;
    playCount?: number;
    thumbnailKind?: string;
    isOfficial?: boolean;
  };
}
