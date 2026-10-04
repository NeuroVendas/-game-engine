import "./styles.css";
import type { Session } from "@supabase/supabase-js";
import { EditorApp } from "./editor/EditorApp";
import {
  acceptFriend,
  deleteCloudProject,
  getSession,
  loadCloudFavoriteIds,
  loadCloudRecentIds,
  loadFriendConnections,
  loadMyProfile,
  loadMyProjects,
  loadPublicProjects,
  markCloudRecent,
  onAuthChange,
  pingCloud,
  removeFriend,
  requestFriendByUsername,
  setCloudFavorite,
  setCloudVisibility,
  signIn,
  signOut,
  signUp,
  updateMyProfile,
  upsertCloudProject,
  type CloudProfile,
  type FriendConnection
} from "./platform/CloudStore";
import {
  loadPlatformState,
  loadProjects,
  projectId,
  savePlatformState,
  saveProjects,
  type PlatformState
} from "./platform/PlatformStore";
import type { ForgeSceneDocument } from "./types";
import heliosFallback from "../public/scenes/project-helios.forge.json";

type LauncherPage = "home" | "games" | "favorites" | "friends" | "develop";
type GameFilter = "all" | "favorites" | "recent";

const launcher = must<HTMLElement>("launcher");
const studio = must<HTMLElement>("app");
const canvas = must<HTMLCanvasElement>("viewport");
const createDialog = must<HTMLDialogElement>("create-place-dialog");
const gameDetailsDialog = must<HTMLDialogElement>("game-details-dialog");
const profileDialog = must<HTMLDialogElement>("profile-dialog");
const authDialog = must<HTMLDialogElement>("auth-dialog");
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
let publicCloudProjects: ForgeSceneDocument[] = [];
let cloudSession: Session | null = null;
let cloudProfile: CloudProfile | null = null;
let friendConnections: FriendConnection[] = [];
let cloudOnline = false;
let cloudBusy = false;
let currentPage: LauncherPage = "home";
let currentGameFilter: GameFilter = "all";
let renamingProjectId: string | null = null;
let detailsSceneId: string | null = null;
let openCardMenuId: string | null = null;
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

function isOfficial(scene: ForgeSceneDocument): boolean {
  return Boolean(scene.platform?.isOfficial) || scene.name === "Project Helios";
}

function officialScene(): ForgeSceneDocument {
  return publicCloudProjects.find((scene) => scene.platform?.isOfficial)
    ?? structuredClone(heliosFallback as ForgeSceneDocument);
}

function sceneKey(scene: ForgeSceneDocument): string {
  if (scene.platform?.isOfficial) return "official:helios";
  if (scene.platform?.cloudId) return `cloud:${scene.platform.cloudId}`;
  return `local:${scene.name.toLowerCase()}`;
}

function dedupeScenes(scenes: ForgeSceneDocument[]): ForgeSceneDocument[] {
  const seen = new Set<string>();
  const result: ForgeSceneDocument[] = [];

  for (const scene of scenes) {
    const key = sceneKey(scene);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(scene);
  }

  return result;
}

function catalogPlaces(): ForgeSceneDocument[] {
  return dedupeScenes([
    officialScene(),
    ...projects,
    ...publicCloudProjects.filter((scene) => !scene.platform?.isOfficial)
  ]);
}

function developPlaces(): ForgeSceneDocument[] {
  return dedupeScenes([officialScene(), ...projects]);
}

function sceneById(id: string): ForgeSceneDocument | null {
  return catalogPlaces().find((scene) => projectId(scene) === id || sceneKey(scene) === id) ?? null;
}

function uniqueProjectName(base: string): string {
  const clean = base.trim() || "My Place";
  const names = new Set(projects.map((scene) => scene.name.toLowerCase()));
  if (!names.has(clean.toLowerCase())) return clean;

  let index = 2;
  while (names.has(`${clean} ${index}`.toLowerCase())) index += 1;
  return `${clean} ${index}`;
}

function canEdit(scene: ForgeSceneDocument): boolean {
  if (isOfficial(scene)) return false;
  if (!scene.platform?.cloudId) return true;
  return Boolean(cloudSession?.user.id && scene.platform.ownerId === cloudSession.user.id);
}

function replaceProject(scene: ForgeSceneDocument, previousId?: string): void {
  const id = previousId ?? projectId(scene);
  const index = projects.findIndex((item) =>
    projectId(item) === id
    || (scene.platform?.cloudId && item.platform?.cloudId === scene.platform.cloudId)
    || (!scene.platform?.cloudId && item.name === scene.name)
  );

  if (index >= 0) projects[index] = structuredClone(scene);
  else projects.unshift(structuredClone(scene));

  saveProjects(projects);
}

async function saveScene(scene: ForgeSceneDocument, previousId?: string): Promise<ForgeSceneDocument> {
  if (isOfficial(scene)) return scene;

  replaceProject(scene, previousId);

  if (!cloudSession || !cloudOnline) {
    renderAll();
    return scene;
  }

  try {
    const cloudScene = await upsertCloudProject(cloudSession.user.id, scene);
    replaceProject(cloudScene, previousId ?? projectId(scene));
    await refreshPublicCloud();
    renderAll();
    return cloudScene;
  } catch (error) {
    console.error("Cloud save failed", error);
    setCloudStatus("Forge Cloud save failed — local copy is safe.", true);
    renderAll();
    return scene;
  }
}

async function refreshPublicCloud(): Promise<void> {
  if (!cloudOnline) return;
  try {
    publicCloudProjects = await loadPublicProjects();
    launcher.dataset.cloudCatalogCount = String(publicCloudProjects.length);
  } catch (error) {
    console.error("Public catalog failed", error);
    setCloudStatus("Forge Cloud catalog unavailable — local mode active.", true);
  }
}

async function syncLocalProjectsToCloud(): Promise<void> {
  if (!cloudSession || !cloudOnline || cloudBusy) return;
  cloudBusy = true;

  try {
    const userId = cloudSession.user.id;
    const next: ForgeSceneDocument[] = [];

    for (const scene of projects) {
      if (scene.platform?.cloudId) {
        next.push(scene);
        continue;
      }

      try {
        next.push(await upsertCloudProject(userId, scene));
      } catch (error) {
        console.error("Project sync failed", scene.name, error);
        next.push(scene);
      }
    }

    projects = dedupeScenes(next);
    saveProjects(projects);
    await refreshPublicCloud();
  } finally {
    cloudBusy = false;
  }
}

async function hydrateAccount(session: Session): Promise<void> {
  cloudSession = session;

  try {
    const [profile, myProjects, favoriteIds, recentIds] = await Promise.all([
      loadMyProfile(session.user.id),
      loadMyProjects(session.user.id),
      loadCloudFavoriteIds(session.user.id),
      loadCloudRecentIds(session.user.id)
    ]);

    cloudProfile = profile;
    if (profile?.display_name) state.profile.displayName = profile.display_name;

    const localOnly = projects.filter((scene) => !scene.platform?.cloudId);
    projects = dedupeScenes([...myProjects, ...localOnly]);
    saveProjects(projects);

    const normalizeCloudId = (id: string): string => {
      if (!id.startsWith("cloud:")) return id;
      const cloudId = id.slice("cloud:".length);
      const scene = [...myProjects, ...publicCloudProjects].find((item) => item.platform?.cloudId === cloudId);
      return scene ? projectId(scene) : id;
    };

    state.favorites = [...new Set([...state.favorites, ...favoriteIds.map(normalizeCloudId)])];
    state.recent = [...new Set([...recentIds.map(normalizeCloudId), ...state.recent])].slice(0, 12);
    savePlatformState(state);

    await syncLocalProjectsToCloud();
    await refreshFriends();
    setCloudStatus(`Forge Cloud Online • @${cloudProfile?.username ?? "account"}`);
  } catch (error) {
    console.error("Account hydration failed", error);
    setCloudStatus("Signed in, but cloud data could not fully load.", true);
  }

  renderAll();
}

function clearCloudAccountState(): void {
  cloudSession = null;
  cloudProfile = null;
  friendConnections = [];

  // Never expose cached private projects from a previous account after sign-out.
  projects = projects.filter((scene) => !scene.platform?.cloudId);
  state.favorites = state.favorites.filter((id) => !id.startsWith("cloud:"));
  state.recent = state.recent.filter((id) => !id.startsWith("cloud:"));
  saveProjects(projects);
  savePlatformState(state);

  setCloudStatus(cloudOnline ? "Forge Cloud Online • Guest" : "Forge Cloud Offline", !cloudOnline);
  renderAll();
}

function setCloudStatus(message: string, error = false): void {
  launcher.dataset.cloudSession = cloudSession ? "signed-in" : "guest";
  const status = must<HTMLElement>("cloud-status");
  status.textContent = `● ${message}`;
  status.classList.toggle("cloud-online", !error && cloudOnline);
  status.classList.toggle("cloud-error", error);

  const dot = must<HTMLElement>("account-dot");
  dot.classList.toggle("signed-in", Boolean(cloudSession));
  dot.classList.toggle("guest", !cloudSession);
}

async function bootstrapCloud(): Promise<void> {
  try {
    cloudOnline = await pingCloud();

    if (!cloudOnline) {
      setCloudStatus("Forge Cloud Offline • Local mode", true);
      renderAll();
      return;
    }

    setCloudStatus("Forge Cloud Online • Guest");
    await refreshPublicCloud();

    const session = await getSession();
    if (session) await hydrateAccount(session);
    else renderAll();

    onAuthChange((nextSession) => {
      if (nextSession?.user.id === cloudSession?.user.id) return;
      if (nextSession) void hydrateAccount(nextSession);
      else clearCloudAccountState();
    });
  } catch (error) {
    console.error("Cloud bootstrap failed", error);
    cloudOnline = false;
    setCloudStatus("Forge Cloud Offline • Local mode", true);
    renderAll();
  }
}

async function markRecent(scene: ForgeSceneDocument): Promise<void> {
  const id = projectId(scene);
  state.recent = [id, ...state.recent.filter((item) => item !== id)].slice(0, 12);
  savePlatformState(state);
  renderAll();

  if (cloudSession && scene.platform?.cloudId) {
    try {
      await markCloudRecent(cloudSession.user.id, scene);
    } catch (error) {
      console.error("Cloud recent failed", error);
    }
  }
}

async function toggleFavorite(scene: ForgeSceneDocument): Promise<void> {
  const id = projectId(scene);
  const favorite = !state.favorites.includes(id);

  state.favorites = favorite
    ? [id, ...state.favorites]
    : state.favorites.filter((item) => item !== id);

  savePlatformState(state);
  renderAll();

  if (cloudSession && scene.platform?.cloudId) {
    try {
      await setCloudFavorite(cloudSession.user.id, scene, favorite);
    } catch (error) {
      console.error("Cloud favorite failed", error);
      setCloudStatus("Favorite saved locally; cloud sync failed.", true);
    }
  }
}

function isFavorite(scene: ForgeSceneDocument): boolean {
  return state.favorites.includes(projectId(scene));
}

function metaLabel(scene: ForgeSceneDocument): string {
  if (isOfficial(scene)) return "Forge official • Public";
  if (scene.platform?.cloudId) {
    return `Forge Cloud • ${scene.platform.visibility === "public" ? "Public" : "Private"}`;
  }
  return cloudSession ? "Local • syncing to cloud" : "Local only • sign in to sync";
}

function projectCard(scene: ForgeSceneDocument, context: "game" | "develop"): HTMLElement {
  const id = projectId(scene);
  const official = isOfficial(scene);
  const editable = canEdit(scene);
  const card = document.createElement("article");
  card.className = "game-card place-card";
  card.dataset.placeId = id;
  card.dataset.placeName = scene.name;

  const title = escapeHtml(scene.name);
  const thumbClass = official ? "helios-thumb" : "user-thumb";
  const subtitle = official ? "Industrial reactor benchmark" : sceneDescription(scene);
  const favorite = isFavorite(scene);
  const visibility = scene.platform?.visibility ?? "private";

  card.innerHTML = `
    <div class="game-thumb ${thumbClass}">
      ${official ? '<div class="reactor-ring"></div>' : '<span>=]</span>'}
      <span class="thumb-label">${title}</span>
    </div>
    <div class="game-info">
      <h3>${title}</h3>
      <p>${subtitle}</p>
      <div class="game-meta">${escapeHtml(metaLabel(scene))}</div>
    </div>
    <div class="card-actions">
      <button data-action="favorite" title="Favorite">${favorite ? "★" : "☆"}</button>
      <button data-action="play" class="play-card">Play</button>
      ${official ? '<button data-action="remix">Remix</button>' : editable ? '<button data-action="edit">Edit</button>' : ""}
      ${context === "develop" && editable && !official ? '<button data-action="more" class="more-action">More ▾</button>' : ""}
    </div>
    ${context === "develop" && editable && !official ? `
      <div class="card-menu" ${openCardMenuId === id ? "" : "hidden"}>
        <button data-action="duplicate">Duplicate</button>
        <button data-action="rename">Rename</button>
        <button data-action="publish">${visibility === "public" ? "Make Private" : "Publish"}</button>
        <button data-action="delete" class="danger-action">Delete</button>
      </div>
    ` : ""}
  `;

  card.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLButtonElement>("[data-action]")?.dataset.action;
    if (!action) {
      openGameDetails(scene);
      return;
    }
    event.stopPropagation();

    if (action === "favorite") void toggleFavorite(scene);
    if (action === "play") void playPlace(scene);
    if (action === "edit") void editPlace(scene);
    if (action === "remix") void remixPlace(scene);

    if (action === "more") {
      openCardMenuId = openCardMenuId === id ? null : id;
      renderAll();
    }

    if (action === "duplicate") {
      openCardMenuId = null;
      const copy = structuredClone(scene);
      copy.name = uniqueProjectName(`${scene.name} Copy`);
      delete copy.platform;
      projects.unshift(copy);
      saveProjects(projects);
      renderAll();
    }

    if (action === "rename") {
      openCardMenuId = null;
      renamingProjectId = id;
      const input = must<HTMLInputElement>("rename-place-name");
      input.value = scene.name;
      const menu = card.querySelector<HTMLElement>(".card-menu");
      if (menu) menu.hidden = true;
      renameDialog.showModal();
      requestAnimationFrame(() => input.select());
    }

    if (action === "publish") {
      openCardMenuId = null;
      void togglePublish(scene);
    }

    if (action === "delete") {
      openCardMenuId = null;
      void deletePlace(scene);
    }
  });

  return card;
}

function creatorLabel(scene: ForgeSceneDocument): string {
  if (isOfficial(scene)) return "Forge";
  if (canEdit(scene)) return cloudProfile?.username ? `@${cloudProfile.username}` : "You";
  if (scene.platform?.ownerUsername) return `@${scene.platform.ownerUsername}`;
  return scene.platform?.ownerDisplayName || "Community Creator";
}

function sceneDescription(scene: ForgeSceneDocument): string {
  if (scene.platform?.description?.trim()) return scene.platform.description.trim();
  if (isOfficial(scene)) return "Industrial reactor simulation and the official benchmark place used to develop Forge.";
  return "A Forge place.";
}

function openGameDetails(scene: ForgeSceneDocument): void {
  detailsSceneId = projectId(scene);
  const editable = canEdit(scene);
  const favorite = isFavorite(scene);
  const official = isOfficial(scene);

  must<HTMLElement>("game-detail-title").textContent = scene.name;
  must<HTMLElement>("game-detail-creator").textContent = creatorLabel(scene);
  must<HTMLElement>("game-detail-meta").textContent = metaLabel(scene);

  const thumb = must<HTMLElement>("game-detail-thumb");
  thumb.className = `game-detail-thumb ${official ? "helios-thumb" : "user-thumb"}`;
  thumb.innerHTML = official ? '<div class="reactor-ring"></div><span>PROJECT HELIOS</span>' : '<span>=]</span>';

  const description = must<HTMLTextAreaElement>("game-detail-description");
  description.value = sceneDescription(scene);
  description.readOnly = !editable;

  const visibility = must<HTMLSelectElement>("game-detail-visibility");
  visibility.value = scene.platform?.visibility ?? "private";
  visibility.disabled = !editable || !cloudSession;

  must<HTMLElement>("game-detail-visibility-row").hidden = official;
  must<HTMLButtonElement>("game-detail-favorite").textContent = favorite ? "★ Favorited" : "☆ Favorite";
  must<HTMLButtonElement>("game-detail-save").hidden = !editable;
  must<HTMLButtonElement>("game-detail-edit").textContent = official ? "Remix" : "Edit";
  must<HTMLButtonElement>("game-detail-edit").hidden = !official && !editable;

  const note = must<HTMLElement>("game-detail-note");
  if (official) {
    note.textContent = "Official Forge sample. Remix it to make your own editable copy.";
  } else if (editable && !cloudSession) {
    note.textContent = "Saved locally. Sign in to Forge Cloud to publish and sync this place.";
  } else if (editable) {
    note.textContent = "Description and visibility sync with Forge Cloud.";
  } else {
    const updated = scene.platform?.updatedAt
      ? new Date(scene.platform.updatedAt).toLocaleDateString()
      : "recently";
    note.textContent = `Public Forge place • updated ${updated}.`;
  }

  gameDetailsDialog.showModal();
}

async function saveGameDetails(): Promise<void> {
  if (!detailsSceneId) return;
  const scene = sceneById(detailsSceneId);
  if (!scene || !canEdit(scene) || isOfficial(scene)) return;

  const oldId = projectId(scene);
  const platform = scene.platform ?? (scene.platform = {});
  platform.description = must<HTMLTextAreaElement>("game-detail-description").value.trim();

  const visibility = must<HTMLSelectElement>("game-detail-visibility").value as "private" | "unlisted" | "public";
  if (cloudSession) platform.visibility = visibility;
  else platform.visibility = "private";

  const saved = await saveScene(scene, oldId);
  detailsSceneId = projectId(saved);
  openGameDetails(saved);
}

function homePlaceCard(scene: ForgeSceneDocument): HTMLElement {
  const card = document.createElement("article");
  card.className = "wide-place-card";
  const official = isOfficial(scene);

  card.innerHTML = `
    <div class="wide-thumb ${official ? "helios-thumb" : "user-thumb"}">
      ${official ? '<div class="reactor-ring"></div>' : '<span>=]</span>'}
    </div>
    <div class="wide-info">
      <h3>${escapeHtml(scene.name)}</h3>
      <p>${official ? "Forge benchmark place" : "Your place"}</p>
      <small>${escapeHtml(metaLabel(scene))}</small>
    </div>
    <div class="wide-actions">
      <button data-home-action="play">Play</button>
      <button data-home-action="${official ? "remix" : "edit"}">${official ? "Remix" : "Edit"}</button>
    </div>
  `;

  card.querySelector("[data-home-action='play']")?.addEventListener("click", () => void playPlace(scene));
  card.querySelector("[data-home-action='edit']")?.addEventListener("click", () => void editPlace(scene));
  card.querySelector("[data-home-action='remix']")?.addEventListener("click", () => void remixPlace(scene));
  return card;
}

function recentRow(scene: ForgeSceneDocument): HTMLElement {
  const row = document.createElement("article");
  row.className = "list-place";
  row.innerHTML = `
    <div class="tiny-thumb ${isOfficial(scene) ? "helios-thumb" : "user-thumb"}"></div>
    <div><b>${escapeHtml(scene.name)}</b><span>${isFavorite(scene) ? "★ Favorite" : metaLabel(scene)}</span></div>
    <button>Play</button>
  `;
  row.querySelector("button")?.addEventListener("click", () => void playPlace(scene));
  return row;
}

async function refreshFriends(): Promise<void> {
  if (!cloudSession) {
    friendConnections = [];
    renderFriends();
    return;
  }

  try {
    friendConnections = await loadFriendConnections();
  } catch (error) {
    console.error("Friend list failed", error);
    friendConnections = [];
  }

  renderFriends();
}

function friendRow(connection: FriendConnection): HTMLElement {
  const row = document.createElement("div");
  row.className = "person-row";
  row.innerHTML = `
    <div class="person-face">=]</div>
    <div class="person-info">
      <b>${escapeHtml(connection.display_name)}</b>
      <span>@${escapeHtml(connection.username)}</span>
    </div>
    <div class="person-actions"></div>
  `;

  const actions = row.querySelector<HTMLDivElement>(".person-actions")!;

  if (connection.direction === "incoming") {
    const accept = document.createElement("button");
    accept.textContent = "Accept";
    accept.addEventListener("click", () => {
      void (async () => {
        try {
          await acceptFriend(connection.other_id);
          await refreshFriends();
        } catch (error) {
          showFriendMessage(error instanceof Error ? error.message : String(error), true);
        }
      })();
    });
    actions.appendChild(accept);
  }

  const remove = document.createElement("button");
  remove.textContent = connection.direction === "friend"
    ? "Remove"
    : connection.direction === "outgoing"
      ? "Cancel"
      : "Decline";
  remove.addEventListener("click", () => {
    void (async () => {
      try {
        await removeFriend(connection.other_id);
        await refreshFriends();
      } catch (error) {
        showFriendMessage(error instanceof Error ? error.message : String(error), true);
      }
    })();
  });
  actions.appendChild(remove);

  return row;
}

function renderFriends(): void {
  const guest = must<HTMLElement>("friends-guest");
  const app = must<HTMLElement>("friends-app");

  guest.hidden = Boolean(cloudSession);
  app.hidden = !cloudSession;

  if (!cloudSession) return;

  const friends = friendConnections.filter((item) => item.direction === "friend");
  const requests = friendConnections.filter((item) => item.direction !== "friend");

  must<HTMLElement>("friends-count").textContent = String(friends.length);
  must<HTMLElement>("requests-count").textContent = String(requests.length);

  const friendsList = must<HTMLElement>("friends-list");
  friendsList.replaceChildren();
  if (!friends.length) {
    const empty = document.createElement("div");
    empty.className = "people-empty";
    empty.textContent = "No friends yet. Add someone by username.";
    friendsList.appendChild(empty);
  } else {
    for (const connection of friends) friendsList.appendChild(friendRow(connection));
  }

  const requestsList = must<HTMLElement>("requests-list");
  requestsList.replaceChildren();
  if (!requests.length) {
    const empty = document.createElement("div");
    empty.className = "people-empty";
    empty.textContent = "No pending requests.";
    requestsList.appendChild(empty);
  } else {
    for (const connection of requests) requestsList.appendChild(friendRow(connection));
  }
}

function showFriendMessage(message: string, error = false): void {
  const box = must<HTMLElement>("friend-message");
  box.textContent = message;
  box.className = `friend-message ${error ? "error" : "success"}`;
}

async function sendFriendRequestFromUI(): Promise<void> {
  if (!cloudSession) {
    openAuth("Sign in to add friends.");
    return;
  }

  const input = must<HTMLInputElement>("friend-username");
  const username = input.value.trim();
  if (!username) {
    showFriendMessage("Enter an exact Forge username.", true);
    return;
  }

  try {
    const result = await requestFriendByUsername(username);
    input.value = "";
    showFriendMessage(
      result === "accepted"
        ? "Friend request accepted — you are now friends."
        : "Friend request sent."
    );
    await refreshFriends();
  } catch (error) {
    showFriendMessage(error instanceof Error ? error.message : String(error), true);
  }
}

function renderAll(): void {
  const displayName = cloudProfile?.display_name || state.profile.displayName || "Builder";

  document.querySelectorAll<HTMLElement>("[data-display-name]").forEach((node) => {
    node.textContent = displayName;
  });

  must<HTMLElement>("account-label").textContent = cloudSession
    ? displayName
    : "Sign In";

  const all = catalogPlaces();
  const develop = developPlaces();
  const recentScenes = state.recent
    .map(sceneById)
    .filter((scene): scene is ForgeSceneDocument => Boolean(scene));
  const favoriteScenes = all.filter(isFavorite);

  must<HTMLElement>("favorite-count").textContent = String(favoriteScenes.length);
  must<HTMLElement>("project-count").textContent = String(develop.length);
  must<HTMLElement>("stat-projects").textContent = String(develop.length);
  must<HTMLElement>("stat-favorites").textContent = String(favoriteScenes.length);
  must<HTMLElement>("stat-recent").textContent = String(recentScenes.length);
  must<HTMLElement>("develop-count").textContent = `${develop.length} ${develop.length === 1 ? "place" : "places"}`;

  homeProjects.replaceChildren();
  for (const scene of develop.slice(0, 3)) {
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
  const developScenes = search && currentPage === "develop"
    ? develop.filter((scene) => scene.name.toLowerCase().includes(search))
    : develop;

  for (const scene of developScenes) developGrid.appendChild(projectCard(scene, "develop"));

  renderFriends();
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
      : page === "friends" ? "Search people..."
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
  if (!canEdit(scene)) {
    if (isOfficial(scene)) {
      await remixPlace(scene);
      return;
    }
    return;
  }

  sessionMode = "edit";
  launcher.hidden = true;
  studio.hidden = false;
  studio.classList.remove("game-session");
  await ensureEditor(scene);
}

async function remixPlace(scene: ForgeSceneDocument): Promise<void> {
  const copy = structuredClone(scene);
  delete copy.platform;
  copy.name = uniqueProjectName(`${scene.name} Copy`);
  projects.unshift(copy);
  saveProjects(projects);
  renderAll();
  await editPlace(copy);
}

async function playPlace(scene: ForgeSceneDocument): Promise<void> {
  sessionMode = "play";
  launcher.hidden = true;
  studio.hidden = false;
  studio.classList.add("game-session");
  must<HTMLElement>("game-session-title").textContent = scene.name;

  await ensureEditor(scene);
  editor?.startPlay();
  await markRecent(scene);
  requestAnimationFrame(() => editor?.forge.resize());
}

async function returnToLauncher(page: LauncherPage = currentPage): Promise<void> {
  if (sessionMode === "edit" && editor) {
    await saveScene(editor.getDocument());
  }

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

function openAuth(message?: string): void {
  const messageBox = must<HTMLElement>("auth-message");
  messageBox.textContent = message ?? "You can keep using Forge as a guest without signing in.";
  messageBox.className = "auth-message";
  must<HTMLInputElement>("auth-display-name").value = state.profile.displayName || "Builder";
  authDialog.showModal();
}

function openProfile(): void {
  if (!cloudSession || !cloudProfile) {
    openAuth("Sign in to create a cloud profile and sync your Forge account.");
    return;
  }

  must<HTMLInputElement>("profile-username").value = cloudProfile.username;
  must<HTMLInputElement>("profile-display-name").value = cloudProfile.display_name;
  must<HTMLTextAreaElement>("profile-bio").value = cloudProfile.bio;
  must<HTMLElement>("profile-email").textContent = cloudSession.user.email ?? "Forge account";
  must<HTMLElement>("profile-cloud-name").textContent = `@${cloudProfile.username}`;
  must<HTMLElement>("profile-note").textContent = "Synced with Forge Cloud.";
  profileDialog.showModal();
}

async function handleSignIn(): Promise<void> {
  const email = must<HTMLInputElement>("auth-email").value.trim();
  const password = must<HTMLInputElement>("auth-password").value;
  const message = must<HTMLElement>("auth-message");

  message.className = "auth-message";
  message.textContent = "Signing in...";

  try {
    const session = await signIn(email, password);
    await hydrateAccount(session);
    message.className = "auth-message success";
    message.textContent = "Signed in. Your Forge Cloud data is loading.";
    authDialog.close();
  } catch (error) {
    message.className = "auth-message error";
    message.textContent = error instanceof Error ? error.message : String(error);
  }
}

async function handleSignUp(): Promise<void> {
  const email = must<HTMLInputElement>("auth-email").value.trim();
  const password = must<HTMLInputElement>("auth-password").value;
  const displayName = must<HTMLInputElement>("auth-display-name").value.trim();
  const message = must<HTMLElement>("auth-message");

  message.className = "auth-message";
  message.textContent = "Creating Forge account...";

  try {
    const result = await signUp(email, password, displayName);

    if (result.session) {
      await hydrateAccount(result.session);
      message.className = "auth-message success";
      message.textContent = "Account created and signed in.";
      authDialog.close();
      return;
    }

    message.className = "auth-message success";
    message.textContent = "Account created. Check your email to confirm it, then return here and Sign In.";
  } catch (error) {
    message.className = "auth-message error";
    message.textContent = error instanceof Error ? error.message : String(error);
  }
}

async function togglePublish(scene: ForgeSceneDocument): Promise<void> {
  if (!cloudSession) {
    openAuth("Sign in first. Publishing requires a Forge Cloud account.");
    return;
  }

  try {
    const visibility = scene.platform?.visibility === "public" ? "private" : "public";
    const cloudScene = await setCloudVisibility(cloudSession.user.id, scene, visibility);
    replaceProject(cloudScene, projectId(scene));
    await refreshPublicCloud();
    renderAll();
  } catch (error) {
    alert(error instanceof Error ? error.message : String(error));
  }
}

async function deletePlace(scene: ForgeSceneDocument): Promise<void> {
  if (!confirm(`Delete "${scene.name}"? This cannot be undone.`)) return;

  if (cloudSession && scene.platform?.cloudId) {
    try {
      await deleteCloudProject(cloudSession.user.id, scene);
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
      return;
    }
  }

  const id = projectId(scene);
  projects = projects.filter((item) => projectId(item) !== id);
  state.favorites = state.favorites.filter((item) => item !== id);
  state.recent = state.recent.filter((item) => item !== id);
  saveProjects(projects);
  savePlatformState(state);
  await refreshPublicCloud();
  renderAll();
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

must<HTMLButtonElement>("friends-sign-in").addEventListener("click", () => openAuth("Sign in to use Forge Friends."));
must<HTMLButtonElement>("friend-add-button").addEventListener("click", () => void sendFriendRequestFromUI());
must<HTMLInputElement>("friend-username").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    void sendFriendRequestFromUI();
  }
});

must<HTMLButtonElement>("game-detail-close").addEventListener("click", () => gameDetailsDialog.close());
must<HTMLButtonElement>("game-detail-favorite").addEventListener("click", () => {
  if (!detailsSceneId) return;
  const scene = sceneById(detailsSceneId);
  if (!scene) return;
  void (async () => {
    await toggleFavorite(scene);
    openGameDetails(sceneById(detailsSceneId!) ?? scene);
  })();
});
must<HTMLButtonElement>("game-detail-play").addEventListener("click", () => {
  if (!detailsSceneId) return;
  const scene = sceneById(detailsSceneId);
  if (!scene) return;
  gameDetailsDialog.close();
  void playPlace(scene);
});
must<HTMLButtonElement>("game-detail-edit").addEventListener("click", () => {
  if (!detailsSceneId) return;
  const scene = sceneById(detailsSceneId);
  if (!scene) return;
  gameDetailsDialog.close();
  if (isOfficial(scene)) void remixPlace(scene);
  else void editPlace(scene);
});
must<HTMLButtonElement>("game-detail-save").addEventListener("click", () => void saveGameDetails());

must<HTMLButtonElement>("account-button").addEventListener("click", () => {
  if (cloudSession) openProfile();
  else openAuth();
});
must<HTMLButtonElement>("profile-card-button").addEventListener("click", () => {
  if (cloudSession) openProfile();
  else openAuth();
});
must<HTMLButtonElement>("open-profile").addEventListener("click", () => {
  if (cloudSession) openProfile();
  else openAuth();
});

must<HTMLButtonElement>("auth-sign-in").addEventListener("click", () => void handleSignIn());
must<HTMLButtonElement>("auth-sign-up").addEventListener("click", () => void handleSignUp());
must<HTMLButtonElement>("auth-guest").addEventListener("click", () => authDialog.close());

must<HTMLFormElement>("profile-form").addEventListener("submit", (event) => {
  const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null;
  if (submitter?.value === "cancel" || !cloudSession) return;

  event.preventDefault();

  void (async () => {
    try {
      cloudProfile = await updateMyProfile(cloudSession.user.id, {
        username: must<HTMLInputElement>("profile-username").value,
        display_name: must<HTMLInputElement>("profile-display-name").value,
        bio: must<HTMLTextAreaElement>("profile-bio").value
      });

      state.profile.displayName = cloudProfile.display_name;
      savePlatformState(state);
      profileDialog.close();
      renderAll();
    } catch (error) {
      must<HTMLElement>("profile-note").textContent = error instanceof Error ? error.message : String(error);
    }
  })();
});

must<HTMLButtonElement>("profile-sign-out").addEventListener("click", () => {
  void (async () => {
    try {
      await signOut();
      profileDialog.close();
      clearCloudAccountState();
    } catch (error) {
      must<HTMLElement>("profile-note").textContent = error instanceof Error ? error.message : String(error);
    }
  })();
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

  if (cloudSession) void saveScene(scene);
  void editPlace(scene);
});

must<HTMLFormElement>("rename-place-form").addEventListener("submit", (event) => {
  const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null;
  if (submitter?.value === "cancel" || !renamingProjectId) return;

  event.preventDefault();

  const projectIndex = projects.findIndex((scene) => projectId(scene) === renamingProjectId);
  if (projectIndex < 0) return;

  const oldId = renamingProjectId;
  const scene = projects[projectIndex];
  scene.name = uniqueProjectName(must<HTMLInputElement>("rename-place-name").value);
  const newId = projectId(scene);

  state.favorites = state.favorites.map((id) => id === oldId ? newId : id);
  state.recent = state.recent.map((id) => id === oldId ? newId : id);

  saveProjects(projects);
  savePlatformState(state);
  renameDialog.close();
  renamingProjectId = null;
  renderAll();
  void saveScene(scene, oldId);
});

must<HTMLButtonElement>("home-button").addEventListener("click", () => void returnToLauncher("develop"));
must<HTMLButtonElement>("exit-game").addEventListener("click", () => void returnToLauncher("games"));

window.addEventListener("forge:scene-saved", (event) => {
  const scene = (event as CustomEvent<ForgeSceneDocument>).detail;
  if (!scene) return;
  void saveScene(scene);
});

renderAll();
setPage("home");
void bootstrapCloud();
