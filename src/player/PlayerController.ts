import {
  ArcRotateCamera,
  Color3,
  Mesh,
  MeshBuilder,
  Ray,
  StandardMaterial,
  Vector3
} from "@babylonjs/core";
import type { ForgeEngine } from "../engine/ForgeEngine";

export class PlayerController {
  readonly body: Mesh;
  readonly camera: ArcRotateCamera;

  private readonly avatarParts: Mesh[] = [];
  private readonly arms: [Mesh, Mesh];
  private readonly legs: [Mesh, Mesh];

  private keys = new Set<string>();
  private verticalVelocity = 0;
  private firstPerson = false;
  private interactPressed = false;
  private walkTime = 0;
  private clearanceLevel = 1;

  private readonly onKeyDown = (event: KeyboardEvent) => {
    this.keys.add(event.code);

    if (event.code === "KeyC" && !event.repeat) {
      this.firstPerson = !this.firstPerson;
      this.camera.radius = this.firstPerson ? 0.2 : 6;
      this.setAvatarVisible(!this.firstPerson);
      this.log(this.firstPerson ? "First-person camera." : "Third-person camera.");
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
    private readonly log: (message: string) => void,
    private readonly setPrompt: (text: string | null, locked: boolean) => void = () => {}
  ) {
    const scene = forge.scene;

    this.body = MeshBuilder.CreateCapsule("__player-collider", {
      height: 1.9,
      radius: 0.42,
      subdivisions: 8
    }, scene);
    this.body.position = new Vector3(spawn[0], spawn[1], spawn[2]);
    this.body.checkCollisions = true;
    this.body.ellipsoid = new Vector3(0.42, 0.9, 0.42);
    this.body.ellipsoidOffset = new Vector3(0, 0, 0);
    this.body.isPickable = false;
    this.body.visibility = 0;

    const skin = new StandardMaterial("__avatar-skin", scene);
    skin.diffuseColor = Color3.FromHexString("#e7c6a5");

    const shirt = new StandardMaterial("__avatar-shirt", scene);
    shirt.diffuseColor = Color3.FromHexString("#b7f34a");

    const pants = new StandardMaterial("__avatar-pants", scene);
    pants.diffuseColor = Color3.FromHexString("#3c4a57");

    const head = this.makeAvatarPart("__avatar-head", [0.52, 0.52, 0.52], [0, 0.72, 0], skin);
    const torso = this.makeAvatarPart("__avatar-torso", [0.76, 0.7, 0.38], [0, 0.16, 0], shirt);
    const leftArm = this.makeAvatarPart("__avatar-arm-left", [0.24, 0.72, 0.26], [-0.52, 0.14, 0], skin);
    const rightArm = this.makeAvatarPart("__avatar-arm-right", [0.24, 0.72, 0.26], [0.52, 0.14, 0], skin);
    const leftLeg = this.makeAvatarPart("__avatar-leg-left", [0.28, 0.72, 0.3], [-0.2, -0.58, 0], pants);
    const rightLeg = this.makeAvatarPart("__avatar-leg-right", [0.28, 0.72, 0.3], [0.2, -0.58, 0], pants);

    this.avatarParts.push(head, torso, leftArm, rightArm, leftLeg, rightLeg);
    this.arms = [leftArm, rightArm];
    this.legs = [leftLeg, rightLeg];

    this.camera = new ArcRotateCamera(
      "__player-camera",
      -Math.PI / 2,
      1.15,
      6,
      this.body.position.clone(),
      scene
    );
    this.camera.lowerRadiusLimit = 0.15;
    this.camera.upperRadiusLimit = 10;
    this.camera.wheelPrecision = 18;
    this.camera.panningSensibility = 0;
    this.camera.attachControl(forge.canvas, true);
    scene.activeCamera = this.camera;

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);

    this.log("Play: WASD move • Shift run • Space jump • E interact • C camera");
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

    const moving = direction.lengthSquared() > 0;

    if (moving) {
      direction.normalize();
      const running = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
      const speed = running ? 7.5 : 4.5;
      this.body.moveWithCollisions(direction.scale(speed * dt));
      this.body.rotation.y = Math.atan2(direction.x, direction.z);
      this.animateWalk(dt, running ? 10 : 7);
    } else {
      this.relaxWalkPose(dt);
    }

    const grounded = this.isGrounded();
    if (grounded && this.verticalVelocity < 0) this.verticalVelocity = -0.1;
    if (grounded && this.keys.has("Space")) this.verticalVelocity = 6.2;

    this.verticalVelocity -= 16 * dt;
    this.body.moveWithCollisions(new Vector3(0, this.verticalVelocity * dt, 0));

    this.camera.target = this.body.position.add(new Vector3(0, 0.45, 0));
    this.updateInteractionPrompt();

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
    this.setPrompt(null, false);

    for (const part of this.avatarParts) {
      part.dispose();
    }

    this.body.dispose();
  }

  private makeAvatarPart(
    name: string,
    size: [number, number, number],
    position: [number, number, number],
    material: StandardMaterial
  ): Mesh {
    const part = MeshBuilder.CreateBox(name, {
      width: size[0],
      height: size[1],
      depth: size[2]
    }, this.forge.scene);

    part.parent = this.body;
    part.position = new Vector3(position[0], position[1], position[2]);
    part.material = material;
    part.checkCollisions = false;
    part.isPickable = false;
    return part;
  }

  private setAvatarVisible(visible: boolean): void {
    for (const part of this.avatarParts) {
      part.setEnabled(visible);
    }
  }

  private animateWalk(dt: number, speed: number): void {
    this.walkTime += dt * speed;
    const swing = Math.sin(this.walkTime) * 0.55;

    this.arms[0].rotation.x = swing;
    this.arms[1].rotation.x = -swing;
    this.legs[0].rotation.x = -swing;
    this.legs[1].rotation.x = swing;
  }

  private relaxWalkPose(dt: number): void {
    const blend = Math.min(1, dt * 10);
    for (const limb of [...this.arms, ...this.legs]) {
      limb.rotation.x += (0 - limb.rotation.x) * blend;
    }
  }

  private isGrounded(): boolean {
    const ray = new Ray(this.body.position.add(new Vector3(0, -0.65, 0)), Vector3.Down(), 0.5);
    const hit = this.forge.scene.pickWithRay(ray, (mesh) => mesh !== this.body && mesh.checkCollisions);
    return hit?.hit ?? false;
  }

  private findNearestInteractable(): string | null {
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

    return nearestId;
  }

  private updateInteractionPrompt(): void {
    const nearestId = this.findNearestInteractable();
    if (!nearestId) {
      this.setPrompt(null, false);
      return;
    }

    const entity = this.forge.getEntity(nearestId);
    if (!entity) {
      this.setPrompt(null, false);
      return;
    }

    const requiredClearance = entity.components?.Clearance?.level ?? 0;
    if (requiredClearance > this.clearanceLevel) {
      this.setPrompt(
        `LOCKED • Clearance ${requiredClearance} required • You have ${this.clearanceLevel}`,
        true
      );
      return;
    }

    const prompt = entity.components?.Interactable?.prompt?.trim()
      || `E • ${entity.name}`;
    this.setPrompt(prompt, false);
  }

  private tryInteract(): void {
    const nearestId = this.findNearestInteractable();

    if (!nearestId) {
      this.log("Nothing interactable nearby.");
      return;
    }

    const entity = this.forge.getEntity(nearestId);
    const requiredClearance = entity?.components?.Clearance?.level ?? 0;
    if (requiredClearance > this.clearanceLevel) {
      this.log(`ACCESS DENIED • Clearance ${requiredClearance} required • You have ${this.clearanceLevel}`);
      return;
    }

    this.forge.scripts.interact(nearestId, this.body);
  }
}
