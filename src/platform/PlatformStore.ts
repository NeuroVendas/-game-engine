import type { ForgeSceneDocument } from "../types";

export interface ForgeProfile {
  displayName: string;
}

export interface PlatformState {
  profile: ForgeProfile;
  favorites: string[];
  recent: string[];
}

const stateKey = "forge:platform:v1";
const projectsKey = "forge:projects:v1";

const defaultState: PlatformState = {
  profile: { displayName: "Builder" },
  favorites: [],
  recent: []
};

export function loadPlatformState(): PlatformState {
  try {
    const raw = localStorage.getItem(stateKey);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw) as Partial<PlatformState>;
    return {
      profile: {
        displayName: parsed.profile?.displayName?.trim() || "Builder"
      },
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites.filter((value): value is string => typeof value === "string") : [],
      recent: Array.isArray(parsed.recent) ? parsed.recent.filter((value): value is string => typeof value === "string").slice(0, 12) : []
    };
  } catch {
    return structuredClone(defaultState);
  }
}

export function savePlatformState(state: PlatformState): void {
  localStorage.setItem(stateKey, JSON.stringify(state));
}

export function loadProjects(): ForgeSceneDocument[] {
  try {
    const raw = localStorage.getItem(projectsKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveProjects(projects: ForgeSceneDocument[]): void {
  localStorage.setItem(projectsKey, JSON.stringify(projects.slice(0, 40)));
}

export function projectId(scene: ForgeSceneDocument): string {
  return scene.name === "Project Helios"
    ? "official:helios"
    : `local:${scene.name.toLowerCase()}`;
}
