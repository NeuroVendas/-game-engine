export type Vec3 = [number, number, number];

export type ForgePrimitive = "box" | "wedge" | "sphere" | "capsule" | "cylinder" | "ground" | "empty" | "model";

export type ForgeScriptKind = "Script" | "LocalScript" | "ModuleScript";

export interface ForgeComponents {
  Collider?: {
    enabled: boolean;
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

export interface ForgeSceneDocument {
  format: "forge.scene";
  version: 1;
  name: string;
  playerSpawn?: Vec3;
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
