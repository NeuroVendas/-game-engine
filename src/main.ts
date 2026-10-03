import "./styles.css";
import { EditorApp } from "./editor/EditorApp";
import type { ForgeSceneDocument } from "./types";
import heliosScene from "../public/scenes/project-helios.forge.json";

type LauncherPage = "home" | "games" | "friends" | "develop";

const launcher = document.getElementById("launcher") as HTMLElement;
const studio = document.getElementById("app") as HTMLElement;
const canvas = document.getElementById("viewport") as HTMLCanvasElement;
const dialog = document.getElementById("create-place-dialog") as HTMLDialogElement;
const gameGrid = document.getElementById("game-grid") as HTMLDivElement;
const homeProjects = document.getElementById("home-projects") as HTMLDivElement;
const developCount = document.getElementById("develop-count") as HTMLSpanElement;
const projectName = document.getElementById("studio-project-name") as HTMLSpanElement;
const launcherSearch = document.getElementById("launcher-search") as HTMLInputElement;

let editor: EditorApp | null = null;
let currentLauncherPage: LauncherPage = "home";
const projectsKey = "forge:projects:v1";

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

function getProjects(): ForgeSceneDocument[] {
  try {
    const raw = localStorage.getItem(projectsKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveProject(scene: ForgeSceneDocument): void {
  if (scene.name === "Project Helios") return;

  const projects = getProjects();
  const index = projects.findIndex((item) => item.name === scene.name);
  if (index >= 0) projects[index] = structuredClone(scene);
  else projects.unshift(structuredClone(scene));

  localStorage.setItem(projectsKey, JSON.stringify(projects.slice(0, 24)));
  renderProjects();
}

function makeProjectCard(scene: ForgeSceneDocument, wide = false): HTMLElement {
  const card = document.createElement(wide ? "article" : "article");
  card.className = wide ? "wide-place-card user-wide-card" : "game-card user-game-card";

  if (wide) {
    card.innerHTML = `
      <div class="wide-thumb user-thumb"><span>=]</span></div>
      <div class="wide-info"><h3></h3><p>Custom Forge place</p><small>Saved in this browser</small></div>
      <button class="open-place">Edit</button>
    `;
  } else {
    card.innerHTML = `
      <div class="game-thumb user-thumb"><span>=]</span></div>
      <div class="game-info"><h3></h3><p>Custom Forge place</p><div class="game-meta">Local project</div></div>
      <button class="open-place">Edit</button>
    `;
  }

  const title = card.querySelector("h3");
  if (title) title.textContent = scene.name;
  card.dataset.projectName = scene.name;
  card.addEventListener("click", () => void openStudio(scene));
  return card;
}

function renderProjects(): void {
  document.querySelectorAll(".user-game-card, .user-wide-card").forEach((node) => node.remove());

  const projects = getProjects();
  const anchor = gameGrid.querySelector(".new-card");

  for (const scene of projects) {
    gameGrid.insertBefore(makeProjectCard(scene), anchor);
  }

  for (const scene of projects.slice(0, 3)) {
    homeProjects.appendChild(makeProjectCard(scene, true));
  }

  developCount.textContent = `${projects.length + 1} ${projects.length === 0 ? "place" : "places"}`;
}

function setLauncherPage(page: LauncherPage): void {
  currentLauncherPage = page;

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
      : page === "friends" ? "Search people..."
      : page === "games" ? "Search games..."
      : "Search Forge...";
}

async function openStudio(scene: ForgeSceneDocument): Promise<void> {
  launcher.hidden = true;
  studio.hidden = false;
  projectName.textContent = scene.name;

  if (!editor) {
    editor = new EditorApp(canvas);
    await editor.init(structuredClone(scene));
  } else {
    editor.openDocument(structuredClone(scene));
  }

  requestAnimationFrame(() => editor?.forge.resize());
}

function returnToLauncher(page: LauncherPage = currentLauncherPage): void {
  editor?.returnToLauncher();
  studio.hidden = true;
  launcher.hidden = false;
  renderProjects();
  setLauncherPage(page);
}

function openCreateDialog(): void {
  setLauncherPage("develop");
  const name = document.getElementById("new-place-name") as HTMLInputElement;
  name.value = "My Place";
  dialog.showModal();
  requestAnimationFrame(() => name.select());
}

function filterCurrentPage(query: string): void {
  const normalized = query.trim().toLowerCase();
  const panel = document.querySelector<HTMLElement>(`.launcher-page[data-page="${currentLauncherPage}"]`);
  if (!panel) return;

  panel.querySelectorAll<HTMLElement>(".game-card, .wide-place-card, .list-place").forEach((card) => {
    card.hidden = Boolean(normalized) && !card.textContent?.toLowerCase().includes(normalized);
  });
}

document.querySelectorAll<HTMLElement>("[data-open-helios]").forEach((node) => {
  node.addEventListener("click", () => void openStudio(heliosScene as ForgeSceneDocument));
});

document.querySelectorAll<HTMLElement>("[data-create-place], #new-place, #new-place-side").forEach((node) => {
  node.addEventListener("click", openCreateDialog);
});

document.querySelectorAll<HTMLButtonElement>("[data-launch-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    const page = button.dataset.launchTab as LauncherPage | undefined;
    if (page) setLauncherPage(page);
  });
});

document.querySelectorAll<HTMLButtonElement>("[data-go-page]").forEach((button) => {
  button.addEventListener("click", () => {
    const page = button.dataset.goPage as LauncherPage | undefined;
    if (page) setLauncherPage(page);
  });
});

document.getElementById("launcher-search-button")?.addEventListener("click", () => {
  filterCurrentPage(launcherSearch.value);
});

launcherSearch.addEventListener("input", () => filterCurrentPage(launcherSearch.value));

document.getElementById("create-place-form")?.addEventListener("submit", (event) => {
  const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null;
  if (submitter?.value === "cancel") return;

  event.preventDefault();
  const nameInput = document.getElementById("new-place-name") as HTMLInputElement;
  const template = document.getElementById("new-place-template") as HTMLSelectElement;
  const name = nameInput.value.trim() || "My Place";
  const scene = blankScene(name, template.value === "industrial");

  saveProject(scene);
  dialog.close();
  void openStudio(scene);
});

document.getElementById("home-button")?.addEventListener("click", () => {
  returnToLauncher("develop");
});

window.addEventListener("forge:scene-saved", (event) => {
  const scene = (event as CustomEvent<ForgeSceneDocument>).detail;
  if (scene) saveProject(scene);
});

renderProjects();
setLauncherPage("home");
