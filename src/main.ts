import "./styles.css";
import { EditorApp } from "./editor/EditorApp";
import type { ForgeSceneDocument } from "./types";
import heliosScene from "../public/scenes/project-helios.forge.json";

const launcher = document.getElementById("launcher") as HTMLElement;
const studio = document.getElementById("app") as HTMLElement;
const canvas = document.getElementById("viewport") as HTMLCanvasElement;
const dialog = document.getElementById("create-place-dialog") as HTMLDialogElement;
const gameGrid = document.getElementById("game-grid") as HTMLDivElement;
const projectName = document.getElementById("studio-project-name") as HTMLSpanElement;

let editor: EditorApp | null = null;
const projectsKey = "forge:projects:v1";

function blankScene(name: string, industrial = false): ForgeSceneDocument {
  return {
    format: "forge.scene",
    version: 1,
    name,
    playerSpawn: [0, 1.1, 10],
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

function renderProjects(): void {
  document.querySelectorAll(".user-game-card").forEach((node) => node.remove());
  const anchor = gameGrid.querySelector(".new-card");

  for (const scene of getProjects()) {
    const card = document.createElement("article");
    card.className = "game-card user-game-card";
    card.innerHTML = `
      <div class="game-thumb user-thumb"><span>=]</span></div>
      <div class="game-info">
        <h3></h3>
        <p>Custom Forge place</p>
        <div class="game-meta">Local project</div>
      </div>
      <button class="open-place">Edit</button>
    `;
    const title = card.querySelector("h3");
    if (title) title.textContent = scene.name;
    card.addEventListener("click", () => void openStudio(scene));
    gameGrid.insertBefore(card, anchor);
  }
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

function openCreateDialog(): void {
  const name = document.getElementById("new-place-name") as HTMLInputElement;
  name.value = "My Place";
  dialog.showModal();
  requestAnimationFrame(() => name.select());
}

document.querySelectorAll("[data-open-helios]").forEach((node) => {
  node.addEventListener("click", () => void openStudio(heliosScene as ForgeSceneDocument));
});

document.querySelectorAll("[data-create-place], #new-place, #new-place-side").forEach((node) => {
  node.addEventListener("click", openCreateDialog);
});

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
  editor?.returnToLauncher();
  studio.hidden = true;
  launcher.hidden = false;
  renderProjects();
});

window.addEventListener("forge:scene-saved", (event) => {
  const scene = (event as CustomEvent<ForgeSceneDocument>).detail;
  if (scene) saveProject(scene);
});

renderProjects();
