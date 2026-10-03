import type { ForgeSceneDocument } from "../types";

export class HistoryManager {
  private undoStack: ForgeSceneDocument[] = [];
  private redoStack: ForgeSceneDocument[] = [];

  constructor(private readonly limit = 50) {}

  checkpoint(document: ForgeSceneDocument): void {
    this.undoStack.push(structuredClone(document));
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
  }

  undo(current: ForgeSceneDocument): ForgeSceneDocument | null {
    const previous = this.undoStack.pop();
    if (!previous) return null;
    this.redoStack.push(structuredClone(current));
    return structuredClone(previous);
  }

  redo(current: ForgeSceneDocument): ForgeSceneDocument | null {
    const next = this.redoStack.pop();
    if (!next) return null;
    this.undoStack.push(structuredClone(current));
    return structuredClone(next);
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}
