import "./styles.css";
import { EditorApp } from "./editor/EditorApp";

const canvas = document.getElementById("viewport") as HTMLCanvasElement | null;

if (!canvas) {
  throw new Error("Forge viewport canvas not found.");
}

const app = new EditorApp(canvas);

app.init().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(error);
  const status = document.getElementById("status");
  if (status) status.textContent = `BOOT ERROR: ${message}`;
});
