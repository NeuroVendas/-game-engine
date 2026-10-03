import "./styles.css";
import { EditorApp } from "./editor/EditorApp";
import {
  loadPlatformState,
  loadProjects,
  projectId,
  savePlatformState,
  saveProjects,
  type PlatformState
} from "./platform/PlatformStore";
import type { ForgeSceneDocument } from "./types";
import heliosScene from "../public/scenes/project-helios.forge.json";

type LauncherPage = "home" | "games" | "favorites" | "friends" | "develop";
type GameFilter = "all" | "favorites" | "recent";

const launcher = must<HTMLElement>("launcher");
const studio = must<HTMLElement>("app");
const canvas = must<HTMLCanvasElement>("viewport");
const createDialog = must<HTMLDialogElement>("create-place-dialog");
const profileDialog = must<HTMLDialogElement>("profile-dialog");
const renameDialog = must<HTMLDialogElement>("rename-place-dialog");
const projectName = must<HTMLSpanElement>("studio-project-name");
const launcherSearch = must<HTMLInputElement>("launcher-search");
const gamesGrid = must<HTMLDivElement>("games-grid");
const favoritesGrid = must<HTMLDivElement>("favorites-grid");
const developGrid = must<HTMLDivElement>("game-grid");
const homeProjects = must<HTMLDivElement>("home-projects");
const recentList = must<HTMLDivElement>("recent-list");

let editor: EditorApp | null = null;
let state: PlatformState = loadPlatformState();
let projects = loadProjects();
let currentPage: LauncherPage = "home";
let currentGameFilter: GameFilter = "all";
let renamingProjectId: string | null = null;
let sessionMode: "edit" | "play" | null = null;

function must<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

function blankScene(name: string, industrial = false): ForgeSceneDocument {
  return {
    format: "forge.scene",
    version: 1,
    name,
    playerSpawn: [0, 1.8, 10],
    entities: [
      {
        id: "Baseplate",
        name: industrial ? "Industrial Baseplate" : "Baseplate",
        kind: "ground",
        position: [0, 0, 0],
        size: [80, 1, 80],
        color: industrial ? "#59636a" : "#6a8f5a",
        components: { Collider: { enabled: true } }
      }
    ]
  };
}

function allPlaces(): ForgeSceneDocument[] {
  return [heliosScene as ForgeSceneDocument, ...projects];
}

function sceneById(id: string): ForgeSceneDocument | null {
  return allPlaces().find((scene) => projectId(scene) === id) ?? null;
}

function uniqueProjectName(base: string): string {
  const clean = base.trim() || "My Place";
  const names = new Set(projects.map((scene) => scene.name.toLowerCase()));
  if (!names.has(clean.toLowerCase())) return clean;

  let index = 2;
  while (names.has(`${clean} ${index}`.toLowerCase())) index += 1;
  return `${clean} ${index}`;
}

function saveLocalScene(scene: ForgeSceneDocument): void {
  if (projectId(scene) === "official:helios") return;

  const existing = projects.findIndex((item) => projectId(item) === projectId(scene));
  if (existing >= 0) projects[existing] = structuredClone(scene);
  else projects.unshift(structuredClone(scene));

  saveProjects(projects);
  renderAll();
}

function markRecent(scene: ForgeSceneDocument): void {
  const id = projectId(scene);
  state.recent = [id, ...state.recent.filter((item) => item !== id)].slice(0, 12);
  savePlatformState(state);
  renderAll();
}

function toggleFavorite(scene: ForgeSceneDocument): void {
  const id = projectId(scene);
  state.favorites = state.favorites.includes(id)
    ? state.favorites.filter((item) => item !== id)
    : [id, ...state.favorites];

  savePlatformState(state);
  renderAll();
}

function isFavorite(scene: ForgeSceneDocument): boolean {
  return state.favorites.includes(projectId(scene));
}

function projectCard(scene: ForgeSceneDocument, context: "game" | "develop"): HTMLElement {
  const id = projectId(scene);
  const official = id === "official:helios";
  const card = document.createElement("article");
  card.className = "game-card place-card";
  card.dataset.placeId = id;

  const title = escapeHtml(scene.name);
  const thumbClass = official ? "helios-thumb" : "user-thumb";
  const subtitle = official ? "Industrial reactor benchmark" : "Custom Forge place";
  const favorite = isFavorite(scene);

  card.innerHTML = `
    <div class="game-thumb ${thumbClass}">
      ${official ? '<div class="reactor-ring"></div>' : '<span>=]</span>'}
      <span class="thumb-label">${title}</span>
    </div>
    <div class="game-info">
      <h3>${title}</h3>
      <p>${subtitle}</p>
      <div class="game-meta">${official ? "Forge official sample" : "Local project"}</div>
    </div>
    <div class="card-actions">
      <button data-action="favorite" title="Favorite">${favorite ? "★" : "☆"}</button>
      <button data-action="play" class="play-card">Play</button>
      <button data-action="edit">Edit</button>
      ${context === "develop" && !official ? '<button data-action="more" class="more-action">More ▾</button>' : ""}
    </div>
    ${context === "develop" && !official ? `
      <div class="card-menu" hidden>
        <button data-action="duplicate">Duplicate</button>
        <button data-action="rename">Rename</button>
        <button data-action="delete" class="danger-action">Delete</button>
      </div>
    ` : ""}
  `;

  card.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLButtonElement>("[data-action]")?.dataset.action;
    if (!action) return;

    event.stopPropagation();

    if (action === "favorite") toggleFavorite(scene);
    if (action === "play") void playPlace(scene);
    if (action === "edit") void editPlace(scene);

    if (action === "more") {
      const menu = card.querySelector<HTMLElement>(".card-menu");
      if (menu) menu.hidden = !menu.hidden;
    }

    if (action === "duplicate") {
      const copy = structuredClone(scene);
      copy.name = uniqueProjectName(`${scene.name} Copy`);
      projects.unshift(copy);
      saveProjects(projects);
      renderAll();
    }

    if (action === "rename") {
      renamingProjectId = id;
      const input = must<HTMLInputElement>("rename-place-name");
      input.value = scene.name;
      const menu = card.querySelector<HTMLElement>(".card-menu");
      if (menu) menu.hidden = true;
      renameDialog.showModal();
      requestAnimationFrame(() => input.select());
    }

    if (action === "delete") {
      if (!confirm(`Delete "${scene.name}" from this browser?`)) return;
      projects = projects.filter((item) => projectId(item) !== id);
      state.favorites = state.favorites.filter((item) => item !== id);
      state.recent = state.recent.filter((item) => item !== id);
      saveProjects(projects);
      savePlatformState(state);
      renderAll();
    }
  });

  return card;
}

function homePlaceCard(scene: ForgeSceneDocument): HTMLElement {
  const card = document.createElement("article");
  card.className = "wide-place-card";
  const official = projectId(scene) === "official:helios";

  card.innerHTML = `
    <div class="wide-thumb ${official ? "helios-thumb" : "user-thumb"}">
      ${official ? '<div class="reactor-ring"></div>' : '<span>=]</span>'}
    </div>
    <div class="wide-info">
      <h3>${escapeHtml(scene.name)}</h3>
      <p>${official ? "Forge benchmark place" : "Your local place"}</p>
      <small>${official ? "Official sample" : "Saved in this browser"}</small>
    </div>
    <div class="wide-actions">
      <button data-home-action="play">Play</button>
      <button data-home-action="edit" class="open-place">Edit</button>
    </div>
  `;

  card.querySelector("[data-home-action='play']")?.addEventListener("click", () => void playPlace(scene));
  card.querySelector("[data-home-action='edit']")?.addEventListener("click", () => void editPlace(scene));
  return card;
}

function recentRow(scene: ForgeSceneDocument): HTMLElement {
  const row = document.createElement("article");
  row.className = "list-place";
  row.innerHTML = `
    <div class="tiny-thumb ${projectId(scene) === "official:helios" ? "helios-thumb" : "user-thumb"}"></div>
    <div><b>${escapeHtml(scene.name)}</b><span>${isFavorite(scene) ? "★ Favorite" : "Forge place"}</span></div>
    <button>Play</button>
  `;
  row.querySelector("button")?.addEventListener("click", () => void playPlace(scene));
  return row;
}

function renderAll(): void {
  document.querySelectorAll<HTMLElement>("[data-display-name]").forEach((node) => {
    node.textContent = state.profile.displayName;
  });

  const all = allPlaces();
  const recentScenes = state.recent.map(sceneById).filter((scene): scene is ForgeSceneDocument => Boolean(scene));
  const favoriteScenes = all.filter(isFavorite);

  must<HTMLElement>("favorite-count").textContent = String(favoriteScenes.length);
  must<HTMLElement>("project-count").textContent = String(all.length);
  must<HTMLElement>("stat-projects").textContent = String(all.length);
  must<HTMLElement>("stat-favorites").textContent = String(favoriteScenes.length);
  must<HTMLElement>("stat-recent").textContent = String(recentScenes.length);
  must<HTMLElement>("develop-count").textContent = `${all.length} ${all.length === 1 ? "place" : "places"}`;

  homeProjects.replaceChildren();
  for (const scene of [heliosScene as ForgeSceneDocument, ...projects.slice(0, 2)]) {
    homeProjects.appendChild(homePlaceCard(scene));
  }

  recentList.replaceChildren();
  if (recentScenes.length === 0) {
    const empty = document.createElement("div");
    empty.className = "classic-empty-row";
    empty.textContent = "Nothing played yet. Open Games and press Play.";
    recentList.appendChild(empty);
  } else {
    for (const scene of recentScenes.slice(0, 5)) recentList.appendChild(recentRow(scene));
  }

  gamesGrid.replaceChildren();
  let games = all;

  if (currentGameFilter === "favorites") games = favoriteScenes;
  if (currentGameFilter === "recent") games = recentScenes;

  const search = launcherSearch.value.trim().toLowerCase();
  if (search && (currentPage === "games" || currentPage === "favorites" || currentPage === "develop")) {
    games = games.filter((scene) => scene.name.toLowerCase().includes(search));
  }

  for (const scene of games) gamesGrid.appendChild(projectCard(scene, "game"));
  must<HTMLElement>("games-empty").hidden = games.length > 0;

  favoritesGrid.replaceChildren();
  const searchedFavorites = search && currentPage === "favorites"
    ? favoriteScenes.filter((scene) => scene.name.toLowerCase().includes(search))
    : favoriteScenes;
  for (const scene of searchedFavorites) favoritesGrid.appendChild(projectCard(scene, "game"));
  must<HTMLElement>("favorites-empty").hidden = searchedFavorites.length > 0;

  developGrid.replaceChildren();
  for (const scene of all) developGrid.appendChild(projectCard(scene, "develop"));
}

function setPage(page: LauncherPage): void {
  currentPage = page;

  document.querySelectorAll<HTMLElement>(".launcher-page").forEach((panel) => {
    panel.hidden = panel.dataset.page !== page;
  });

  document.querySelectorAll<HTMLButtonElement>("[data-launch-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.launchTab === page);
  });

  document.querySelectorAll<HTMLButtonElement>(".side-link").forEach((button) => {
    button.classList.toggle("active", button.dataset.goPage === page);
  });

  launcherSearch.value = "";
  launcherSearch.placeholder =
    page === "develop" ? "Search my places..."
      : page === "favorites" ? "Search favorites..."
      : page === "friends" ? "Search unavailable offline..."
      : page === "games" ? "Search games..."
      : "Search Forge...";

  renderAll();
}

async function ensureEditor(scene: ForgeSceneDocument): Promise<void> {
  projectName.textContent = scene.name;

  if (!editor) {
    editor = new EditorApp(canvas);
    await editor.init(structuredClone(scene));
  } else {
    editor.openDocument(structuredClone(scene));
  }

  requestAnimationFrame(() => editor?.forge.resize());
}

async function editPlace(scene: ForgeSceneDocument): Promise<void> {
  sessionMode = "edit";
  launcher.hidden = true;
  studio.hidden = false;
  studio.classList.remove("game-session");
  await ensureEditor(scene);
}

async function playPlace(scene: ForgeSceneDocument): Promise<void> {
  sessionMode = "play";
  launcher.hidden = true;
  studio.hidden = false;
  studio.classList.add("game-session");
  must<HTMLElement>("game-session-title").textContent = scene.name;

  await ensureEditor(scene);
  editor?.startPlay();
  markRecent(scene);
  requestAnimationFrame(() => editor?.forge.resize());
}

function returnToLauncher(page: LauncherPage = currentPage): void {
  if (editor?.isPlayMode()) editor.stopPlay();
  editor?.returnToLauncher();

  sessionMode = null;
  studio.classList.remove("game-session");
  studio.hidden = true;
  launcher.hidden = false;
  setPage(page);
}

function openCreateDialog(template?: "baseplate" | "industrial"): void {
  setPage("develop");
  const name = must<HTMLInputElement>("new-place-name");
  const select = must<HTMLSelectElement>("new-place-template");
  name.value = uniqueProjectName("My Place");
  if (template) select.value = template;
  createDialog.showModal();
  requestAnimationFrame(() => name.select());
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char] ?? char);
}

document.querySelectorAll<HTMLElement>("[data-create-place], #new-place, #new-place-side").forEach((node) => {
  node.addEventListener("click", () => openCreateDialog());
});

document.querySelectorAll<HTMLElement>("[data-template-create]").forEach((node) => {
  node.addEventListener("click", () => {
    const template = node.dataset.templateCreate === "industrial" ? "industrial" : "baseplate";
    openCreateDialog(template);
  });
});

document.querySelectorAll<HTMLButtonElement>("[data-launch-tab], [data-go-page]").forEach((button) => {
  button.addEventListener("click", () => {
    const page = (button.dataset.launchTab || button.dataset.goPage) as LauncherPage | undefined;
    if (page) setPage(page);
  });
});

document.querySelectorAll<HTMLButtonElement>("[data-game-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    currentGameFilter = (button.dataset.gameFilter as GameFilter | undefined) ?? "all";
    document.querySelectorAll<HTMLButtonElement>("[data-game-filter]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    renderAll();
  });
});

document.querySelectorAll<HTMLButtonElement>("[data-develop-view]").forEach((button) => {
  button.addEventListener("click", () => {
    const templates = button.dataset.developView === "templates";
    must<HTMLElement>("develop-places").hidden = templates;
    must<HTMLElement>("develop-templates").hidden = !templates;
    document.querySelectorAll<HTMLButtonElement>("[data-develop-view]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
  });
});

launcherSearch.addEventListener("input", renderAll);
must<HTMLButtonElement>("launcher-search-button").addEventListener("click", renderAll);

must<HTMLButtonElement>("account-button").addEventListener("click", () => {
  must<HTMLInputElement>("profile-display-name").value = state.profile.displayName;
  profileDialog.showModal();
});

must<HTMLButtonElement>("profile-card-button").addEventListener("click", () => {
  must<HTMLInputElement>("profile-display-name").value = state.profile.displayName;
  profileDialog.showModal();
});

must<HTMLButtonElement>("open-profile").addEventListener("click", () => {
  must<HTMLInputElement>("profile-display-name").value = state.profile.displayName;
  profileDialog.showModal();
});

must<HTMLFormElement>("profile-form").addEventListener("submit", (event) => {
  const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null;
  if (submitter?.value === "cancel") return;

  event.preventDefault();
  const name = must<HTMLInputElement>("profile-display-name").value.trim().slice(0, 24);
  state.profile.displayName = name || "Builder";
  savePlatformState(state);
  profileDialog.close();
  renderAll();
});

must<HTMLFormElement>("create-place-form").addEventListener("submit", (event) => {
  const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null;
  if (submitter?.value === "cancel") return;

  event.preventDefault();
  const name = uniqueProjectName(must<HTMLInputElement>("new-place-name").value);
  const template = must<HTMLSelectElement>("new-place-template").value;
  const scene = blankScene(name, template === "industrial");

  projects.unshift(scene);
  saveProjects(projects);
  createDialog.close();
  renderAll();
  void editPlace(scene);
});

must<HTMLFormElement>("rename-place-form").addEventListener("submit", (event) => {
  const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null;
  if (submitter?.value === "cancel" || !renamingProjectId) return;

  event.preventDefault();
  const projectIndex = projects.findIndex((scene) => projectId(scene) === renamingProjectId);
  if (projectIndex < 0) return;

  const oldId = renamingProjectId;
  const newName = uniqueProjectName(must<HTMLInputElement>("rename-place-name").value);
  projects[projectIndex].name = newName;
  const newId = projectId(projects[projectIndex]);

  state.favorites = state.favorites.map((id) => id === oldId ? newId : id);
  state.recent = state.recent.map((id) => id === oldId ? newId : id);

  saveProjects(projects);
  savePlatformState(state);
  renameDialog.close();
  renamingProjectId = null;
  renderAll();
});

must<HTMLButtonElement>("home-button").addEventListener("click", () => returnToLauncher("develop"));
must<HTMLButtonElement>("exit-game").addEventListener("click", () => returnToLauncher("games"));

window.addEventListener("forge:scene-saved", (event) => {
  const scene = (event as CustomEvent<ForgeSceneDocument>).detail;
  if (!scene) return;
  saveLocalScene(scene);
});

renderAll();
setPage("home");
