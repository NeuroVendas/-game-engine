import type { ForgeEntity } from "../types";

export type ForgePrefabName =
  | "blast-door"
  | "console"
  | "catwalk"
  | "coolant-pump";

export function createPrefabTemplate(
  prefab: ForgePrefabName
): Omit<ForgeEntity, "id"> {
  switch (prefab) {
    case "blast-door":
      return {
        name: "Blast Door",
        kind: "box",
        position: [0, 3, 0],
        size: [6, 6, 0.8],
        color: "#56616a",
        components: {
          Collider: { enabled: true },
          Interactable: { enabled: true, prompt: "E • Open blast door" },
          Door: { openHeight: 6.5 },
          Script: { name: "door.basic" }
        }
      };

    case "console":
      return {
        name: "Control Console",
        kind: "box",
        position: [0, 1.2, 0],
        rotation: [-12, 0, 0],
        size: [3.6, 1.5, 1.4],
        color: "#34434b",
        emissive: "#0e2b35",
        components: {
          Collider: { enabled: true },
          Interactable: { enabled: true, prompt: "E • Use console" },
          Script: { name: "console.status" }
        }
      };

    case "catwalk":
      return {
        name: "Industrial Catwalk",
        kind: "box",
        position: [0, 2.5, 0],
        size: [8, 0.4, 2.4],
        color: "#4a555c",
        components: {
          Collider: { enabled: true }
        }
      };

    case "coolant-pump":
      return {
        name: "Coolant Pump",
        kind: "cylinder",
        position: [0, 1.8, 0],
        size: [2.4, 3.6, 2.4],
        color: "#40515a",
        components: {
          Collider: { enabled: true },
          Interactable: { enabled: true, prompt: "E • Inspect pump" },
          PowerConsumer: { bus: "MAIN", draw: 4, required: true },
          Script: { name: "console.status" }
        }
      };
  }
}
