import {
  ArcRotateCamera,
  Mesh,
  MeshBuilder,
  Ray,
  StandardMaterial,
  Color3,
  Vector3
} from "@babylonjs/core";
import type { ForgeEngine } from "../engine/ForgeEngine";

export class PlayerController {
  readonly body: Mesh;
  readonly camera: ArcRotateCamera;

  private keys = new Set<string>();
  private verticalVelocity = 0;
  private firstPerson = false;
  private interactPressed = false;

  private readonly onKeyDown = (event: KeyboardEvent) => {
    this.keys.add(event.code);

    if (event.code === "KeyC" && !event.repeat) {
      this.firstPerson = !this.firstPerson;
      this.camera.radius = this.firstPerson ? 0.2 : 6;
    }

    if (event.code === "KeyE" && !event.repeat) {
      this.interactPressed = true;
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
  };

  constructor(
    private readonly forge: ForgeEngine,
    spawn: [number, number, number],
    private readonly log: (message: string) => void
  ) {
    const scene = forge.scene;

    this.body = MeshBuilder.CreateCapsule("__player", {
      height: 1.8,
      radius: 0.42,
      subdivisions: 12
    }, scene);
    this.body.position = new Vector3(spawn[0], spawn[1], spawn[2]);
    this.body.checkCollisions = true;
    this.body.ellipsoid = new Vector3(0.42, 0.9, 0.42);
    this.body.ellipsoidOffset = new Vector3(0, 0.9, 0);

    const mat = new StandardMaterial("__player-mat", scene);
    mat.diffuseColor = new Color3(0.62, 0.72, 0.78);
    this.body.material = mat;

    this.camera = new ArcRotateCamera(
      "__player-camera",
      -Math.PI / 2,
      1.15,
      6,
      this.body.position.clone(),
      scene
    );
    this.camera.lowerRadiusLimit = 0.15;
    this.camera.upperRadiusLimit = 9;
    this.camera.wheelPrecision = 20;
    this.camera.panningSensibility = 0;
    this.camera.attachControl(forge.canvas, true);
    scene.activeCamera = this.camera;

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);

    this.log("Play mode: WASD move • Shift run • Space jump • E interact • C camera");
  }

  update(dt: number): void {
    const forward = this.camera.getForwardRay().direction.clone();
    forward.y = 0;
    if (forward.lengthSquared() < 0.001) forward.z = 1;
    forward.normalize();

    const right = new Vector3(forward.z, 0, -forward.x);
    const direction = Vector3.Zero();

    if (this.keys.has("KeyW")) direction.addInPlace(forward);
    if (this.keys.has("KeyS")) direction.subtractInPlace(forward);
    if (this.keys.has("KeyD")) direction.addInPlace(right);
    if (this.keys.has("KeyA")) direction.subtractInPlace(right);

    if (direction.lengthSquared() > 0) {
      direction.normalize();
      const speed = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") ? 7.5 : 4.5;
      this.body.moveWithCollisions(direction.scale(speed * dt));
      this.body.rotation.y = Math.atan2(direction.x, direction.z);
    }

    const grounded = this.isGrounded();
    if (grounded && this.verticalVelocity < 0) this.verticalVelocity = -0.1;
    if (grounded && this.keys.has("Space")) this.verticalVelocity = 6.2;

    this.verticalVelocity -= 16 * dt;
    this.body.moveWithCollisions(new Vector3(0, this.verticalVelocity * dt, 0));

    this.camera.target = this.body.position.add(new Vector3(0, 1.15, 0));

    if (this.interactPressed) {
      this.interactPressed = false;
      this.tryInteract();
    }
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.camera.detachControl();
    this.camera.dispose();
    this.body.dispose();
  }

  private isGrounded(): boolean {
    const ray = new Ray(this.body.position.add(new Vector3(0, 0.1, 0)), Vector3.Down(), 1.2);
    const hit = this.forge.scene.pickWithRay(ray, (mesh) => mesh !== this.body && mesh.checkCollisions);
    return hit?.hit ?? false;
  }

  private tryInteract(): void {
    let nearestId: string | null = null;
    let nearestDistance = Infinity;

    for (const entity of this.forge.document.entities) {
      if (!entity.components?.Interactable?.enabled) continue;
      const mesh = this.forge.getMesh(entity.id);
      if (!mesh) continue;

      const distance = Vector3.Distance(this.body.position, mesh.getAbsolutePosition());
      if (distance < 3.2 && distance < nearestDistance) {
        nearestDistance = distance;
        nearestId = entity.id;
      }
    }

    if (!nearestId) {
      this.log("Nothing interactable nearby.");
      return;
    }

    this.forge.scripts.interact(nearestId, this.body);
  }
}
