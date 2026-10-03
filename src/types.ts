export type Vec3 = [number, number, number];

export type ForgePrimitive = "box" | "sphere" | "capsule" | "ground";

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
  Reactor?: {
    power?: number;
    temperature?: number;
  };
  Script?: {
    name: string;
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
}
