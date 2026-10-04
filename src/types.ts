export type Vec3 = [number, number, number];

export type ForgePrimitive = "box" | "wedge" | "sphere" | "capsule" | "cylinder" | "ground";

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
    enabled?: boolean;
    source?: string;
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
  emissive?: string;
  components?: ForgeComponents;
}

export interface ForgeSceneDocument {
  format: "forge.scene";
  version: 1;
  name: string;
  playerSpawn?: Vec3;
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
