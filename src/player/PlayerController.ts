import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Ray } from "@babylonjs/core/Culling/ray";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { ForgeEngine } from "../engine/ForgeEngine";

export class PlayerController {
  readonly body: Mesh;
  readonly camera: ArcRotateCamera;

  private readonly avatarRoot: TransformNode;
  private readonly avatarParts: Mesh[] = [];
  private readonly avatarNodes: TransformNode[] = [];
  private readonly armPivots: [TransformNode, TransformNode];
  private readonly legPivots: [TransformNode, TransformNode];
  private readonly headPivot: TransformNode;

  private readonly keys = new Set<string>();
  private verticalVelocity = 0;
  private horizontalVelocity = Vector3.Zero();
  private coyoteTime = 0;
  private jumpBuffer = 0;
  private grounded = false;
  private firstPerson = false;
  private interactPressed = false;
  private walkTime = 0;
  private clearanceLevel = 1;

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ShiftLeft", "ShiftRight"].includes(event.code)) {
      event.preventDefault();
    }

    this.keys.add(event.code);

    if (event.code === "Space" && !event.repeat) {
      this.jumpBuffer = 0.14;
    }

    if (event.code === "KeyC" && !event.repeat) {
      this.firstPerson = !this.firstPerson;
      this.camera.radius = this.firstPerson ? 0.45 : 6;
      this.avatarRoot.setEnabled(!this.firstPerson);
      this.log(this.firstPerson ? "First-person camera." : "Third-person camera.");
    }

    if (event.code === "KeyE" && !event.repeat) {
      this.interactPressed = true;
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);

    if (event.code === "Space" && this.verticalVelocity > 4) {
      this.verticalVelocity *= 0.62;
    }
  };

  private readonly onBlur = () => {
    this.keys.clear();
  };

  constructor(
    private readonly forge: ForgeEngine,
    spawn: [number, number, number],
    private readonly log: (message: string) => void,
    private readonly setPrompt: (text: string | null, locked: boolean) => void = () => {}
  ) {
    const scene = forge.scene;

    this.body = MeshBuilder.CreateCapsule("__player-collider", {
      height: 3.05,
      radius: 0.45,
      subdivisions: 8
    }, scene);
    this.body.position = new Vector3(spawn[0], spawn[1], spawn[2]);
    this.body.checkCollisions = true;
    this.body.ellipsoid = new Vector3(0.52, 1.48, 0.52);
    this.body.ellipsoidOffset = Vector3.Zero();
    this.body.isPickable = false;
    this.body.visibility = 0;

    this.snapToSafeGround();

    this.avatarRoot = new TransformNode("__forge-classic-avatar", scene);
    this.avatarRoot.parent = this.body;
    this.avatarNodes.push(this.avatarRoot);

    const skin = this.makeMaterial("__avatar-skin", "#d6b15d");
    const shirt = this.makeMaterial("__avatar-shirt", "#e8edf0");
    const pants = this.makeMaterial("__avatar-pants", "#41678f");
    const dark = this.makeMaterial("__avatar-dark", "#202a31");
    const accent = this.makeMaterial("__avatar-accent", "#b7f34a");

    const torso = this.makePart(
      "__avatar-torso",
      [1.42, 1.08, 0.62],
      [0, 0.18, 0],
      shirt,
      this.avatarRoot
    );

    this.headPivot = this.makePivot("__avatar-head-pivot", [0, 0.90, 0], this.avatarRoot);
    const head = this.makeClassicHead("__avatar-head", [0, 0.39, 0], skin);

    const leftShoulder = this.makePivot("__avatar-left-shoulder", [-0.94, 0.64, 0], this.avatarRoot);
    const rightShoulder = this.makePivot("__avatar-right-shoulder", [0.94, 0.64, 0], this.avatarRoot);
    const leftHip = this.makePivot("__avatar-left-hip", [-0.37, -0.40, 0], this.avatarRoot);
    const rightHip = this.makePivot("__avatar-right-hip", [0.37, -0.40, 0], this.avatarRoot);

    this.armPivots = [leftShoulder, rightShoulder];
    this.legPivots = [leftHip, rightHip];

    const limbSize: [number, number, number] = [0.56, 1.18, 0.58];
    this.makePart("__avatar-arm-left", limbSize, [0, -0.53, 0], skin, leftShoulder);
    this.makePart("__avatar-arm-right", limbSize, [0, -0.53, 0], skin, rightShoulder);
    this.makePart("__avatar-leg-left", limbSize, [0, -0.56, 0], pants, leftHip);
    this.makePart("__avatar-leg-right", limbSize, [0, -0.56, 0], pants, rightHip);

    // Original Forge =] face: simple geometric eyes + bracket smile.
    this.makePart("__avatar-eye-left", [0.075, 0.075, 0.035], [-0.16, 0.49, 0.425], dark, this.headPivot);
    this.makePart("__avatar-eye-right", [0.075, 0.075, 0.035], [0.16, 0.49, 0.425], dark, this.headPivot);
    this.makePart("__avatar-smile", [0.25, 0.045, 0.035], [-0.04, 0.28, 0.425], dark, this.headPivot);
    this.makePart("__avatar-smile-bracket", [0.045, 0.18, 0.035], [0.12, 0.34, 0.425], dark, this.headPivot);

    // Forge chest mark. This is deliberately original instead of copying legacy game-platform logos.
    this.makePart("__avatar-badge", [0.48, 0.34, 0.035], [0, 0.18, 0.31], dark, torso);
    this.makePart("__avatar-badge-eq-top", [0.17, 0.035, 0.025], [-0.08, 0.23, 0.34], accent, torso);
    this.makePart("__avatar-badge-eq-bottom", [0.17, 0.035, 0.025], [-0.08, 0.13, 0.34], accent, torso);
    this.makePart("__avatar-badge-bracket", [0.035, 0.19, 0.025], [0.10, 0.18, 0.34], accent, torso);

    this.camera = new ArcRotateCamera(
      "__player-camera",
      -Math.PI / 2,
      1.12,
      6,
      this.body.position.add(new Vector3(0, 0.48, 0)),
      scene
    );
    this.camera.lowerRadiusLimit = 0.35;
    this.camera.upperRadiusLimit = 10;
    this.camera.panningSensibility = 0;
    this.camera.wheelPrecision = 20;
    this.camera.checkCollisions = true;
    this.camera.collisionRadius = new Vector3(0.25, 0.25, 0.25);
    this.camera.attachControl(forge.canvas, true);
    scene.activeCamera = this.camera;

    forge.canvas.dataset.avatarRig = "ForgeClassic6";
    forge.canvas.dataset.avatarShape = "block-head-equal-limbs";
    forge.canvas.dataset.avatarAnimation = "idle";

    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);

    this.log("Play: WASD move • drag mouse to look • wheel zoom • Shift run • Space jump • E interact");
  }

  update(dt: number): void {
    const forward = this.camera.getForwardRay().direction.clone();
    forward.y = 0;
    if (forward.lengthSquared() < 0.001) forward.z = 1;
    forward.normalize();

    const right = new Vector3(forward.z, 0, -forward.x);
    const desiredDirection = Vector3.Zero();

    if (this.keys.has("KeyW")) desiredDirection.addInPlace(forward);
    if (this.keys.has("KeyS")) desiredDirection.subtractInPlace(forward);
    if (this.keys.has("KeyD")) desiredDirection.addInPlace(right);
    if (this.keys.has("KeyA")) desiredDirection.subtractInPlace(right);

    const moving = desiredDirection.lengthSquared() > 0.0001;
    const running = moving && (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"));

    if (moving) desiredDirection.normalize();

    this.grounded = this.isGrounded();
    this.coyoteTime = this.grounded ? 0.12 : Math.max(0, this.coyoteTime - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    if (this.grounded && this.verticalVelocity < 0) {
      this.verticalVelocity = -0.8;
    }

    if (this.jumpBuffer > 0 && this.coyoteTime > 0) {
      this.verticalVelocity = 7.9;
      this.jumpBuffer = 0;
      this.coyoteTime = 0;
      this.grounded = false;
    }

    const targetSpeed = running ? 7.4 : 4.85;
    const targetVelocity = moving
      ? desiredDirection.scale(targetSpeed)
      : Vector3.Zero();

    const acceleration = this.grounded
      ? (moving ? 24 : 34)
      : (moving ? 7.5 : 2.5);

    this.horizontalVelocity = this.moveTowardVector(
      this.horizontalVelocity,
      targetVelocity,
      acceleration * dt
    );

    this.verticalVelocity = Math.max(-30, this.verticalVelocity - 21.5 * dt);

    const frameMotion = new Vector3(
      this.horizontalVelocity.x * dt,
      this.verticalVelocity * dt,
      this.horizontalVelocity.z * dt
    );
    this.body.moveWithCollisions(frameMotion);

    const horizontalSpeed = Math.hypot(this.horizontalVelocity.x, this.horizontalVelocity.z);
    if (horizontalSpeed > 0.08) {
      const targetYaw = Math.atan2(this.horizontalVelocity.x, this.horizontalVelocity.z);
      this.body.rotation.y = this.lerpAngle(
        this.body.rotation.y,
        targetYaw,
        1 - Math.exp(-14 * dt)
      );
    }

    if (!this.grounded || Math.abs(this.verticalVelocity) > 1.0) {
      this.animateJump(dt);
    } else if (horizontalSpeed > 0.18) {
      this.animateClassicWalk(dt, running);
    } else {
      this.animateIdle(dt);
    }

    const desiredCameraTarget = this.body.position.add(new Vector3(0, 0.54, 0));
    Vector3.LerpToRef(
      this.camera.target,
      desiredCameraTarget,
      1 - Math.exp(-18 * dt),
      this.camera.target
    );

    this.forge.canvas.dataset.playerPosition = [
      this.body.position.x.toFixed(3),
      this.body.position.y.toFixed(3),
      this.body.position.z.toFixed(3)
    ].join(",");
    this.forge.canvas.dataset.playerVelocity = [
      this.horizontalVelocity.x.toFixed(3),
      this.verticalVelocity.toFixed(3),
      this.horizontalVelocity.z.toFixed(3)
    ].join(",");
    this.forge.canvas.dataset.playerGrounded = String(this.grounded);
    this.forge.canvas.dataset.cameraAngles = [
      this.camera.alpha.toFixed(4),
      this.camera.beta.toFixed(4),
      this.camera.radius.toFixed(3)
    ].join(",");

    this.updateInteractionPrompt();

    if (this.interactPressed) {
      this.interactPressed = false;
      this.tryInteract();
    }
  }

  private moveTowardVector(current: Vector3, target: Vector3, maxDelta: number): Vector3 {
    const delta = target.subtract(current);
    const distance = delta.length();
    if (distance <= maxDelta || distance < 0.00001) return target.clone();
    return current.add(delta.scale(maxDelta / distance));
  }

  private lerpAngle(current: number, target: number, t: number): number {
    let difference = (target - current + Math.PI) % (Math.PI * 2) - Math.PI;
    if (difference < -Math.PI) difference += Math.PI * 2;
    return current + difference * Math.min(1, Math.max(0, t));
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.camera.detachControl();
    this.camera.dispose();
    this.setPrompt(null, false);

    delete this.forge.canvas.dataset.playerPosition;
    delete this.forge.canvas.dataset.playerVelocity;
    delete this.forge.canvas.dataset.playerGrounded;
    delete this.forge.canvas.dataset.cameraAngles;
    delete this.forge.canvas.dataset.avatarRig;
    delete this.forge.canvas.dataset.avatarShape;
    delete this.forge.canvas.dataset.avatarAnimation;

    for (const part of this.avatarParts) part.dispose();
    for (const node of this.avatarNodes.slice().reverse()) {
      if (!node.isDisposed()) node.dispose();
    }
    this.body.dispose();
  }

  private makeMaterial(name: string, hex: string): StandardMaterial {
    const material = new StandardMaterial(name, this.forge.scene);
    material.diffuseColor = Color3.FromHexString(hex);
    material.specularColor = new Color3(0.08, 0.08, 0.08);
    return material;
  }

  private makePivot(name: string, position: [number, number, number], parent: TransformNode | Mesh): TransformNode {
    const pivot = new TransformNode(name, this.forge.scene);
    pivot.parent = parent;
    pivot.position = new Vector3(position[0], position[1], position[2]);
    this.avatarNodes.push(pivot);
    return pivot;
  }

  private makeClassicHead(
    name: string,
    position: [number, number, number],
    material: StandardMaterial
  ): Mesh {
    const head = MeshBuilder.CreateBox(name, {
      width: 0.84,
      height: 0.82,
      depth: 0.82
    }, this.forge.scene);
    head.parent = this.headPivot;
    head.position = new Vector3(position[0], position[1], position[2]);
    head.material = material;
    head.checkCollisions = false;
    head.isPickable = false;
    this.avatarParts.push(head);
    return head;
  }

  private makePart(
    name: string,
    size: [number, number, number],
    position: [number, number, number],
    material: StandardMaterial,
    parent: TransformNode | Mesh
  ): Mesh {
    const part = MeshBuilder.CreateBox(name, {
      width: size[0],
      height: size[1],
      depth: size[2]
    }, this.forge.scene);

    part.parent = parent;
    part.position = new Vector3(position[0], position[1], position[2]);
    part.material = material;
    part.checkCollisions = false;
    part.isPickable = false;
    this.avatarParts.push(part);
    return part;
  }

  private animateClassicWalk(dt: number, running: boolean): void {
    const cadence = running ? 10.5 : 7.2;
    const amplitude = running ? 0.82 : 0.60;

    this.walkTime += dt * cadence;
    const swing = Math.sin(this.walkTime) * amplitude;
    const bob = Math.abs(Math.sin(this.walkTime * 2)) * (running ? 0.055 : 0.035);

    this.easeRotation(this.armPivots[0], swing, dt, 16);
    this.easeRotation(this.armPivots[1], -swing, dt, 16);
    this.easeRotation(this.legPivots[0], -swing * 0.82, dt, 16);
    this.easeRotation(this.legPivots[1], swing * 0.82, dt, 16);

    this.avatarRoot.position.y += (bob - this.avatarRoot.position.y) * Math.min(1, dt * 18);
    this.headPivot.rotation.z = Math.sin(this.walkTime) * 0.025;
    this.forge.canvas.dataset.avatarAnimation = running ? "run" : "walk";
  }

  private animateIdle(dt: number): void {
    this.easeRotation(this.armPivots[0], 0, dt, 10);
    this.easeRotation(this.armPivots[1], 0, dt, 10);
    this.easeRotation(this.legPivots[0], 0, dt, 10);
    this.easeRotation(this.legPivots[1], 0, dt, 10);

    this.avatarRoot.position.y += (0 - this.avatarRoot.position.y) * Math.min(1, dt * 10);
    this.headPivot.rotation.z += (0 - this.headPivot.rotation.z) * Math.min(1, dt * 8);
    this.forge.canvas.dataset.avatarAnimation = "idle";
  }

  private animateJump(dt: number): void {
    this.easeRotation(this.armPivots[0], -0.35, dt, 12);
    this.easeRotation(this.armPivots[1], -0.35, dt, 12);
    this.easeRotation(this.legPivots[0], 0.18, dt, 12);
    this.easeRotation(this.legPivots[1], -0.18, dt, 12);
    this.avatarRoot.position.y += (0.025 - this.avatarRoot.position.y) * Math.min(1, dt * 10);
    this.forge.canvas.dataset.avatarAnimation = "jump";
  }

  private easeRotation(node: TransformNode, targetX: number, dt: number, speed: number): void {
    node.rotation.x += (targetX - node.rotation.x) * Math.min(1, dt * speed);
  }

  private snapToSafeGround(): void {
    const origin = new Vector3(this.body.position.x, this.body.position.y + 12, this.body.position.z);
    const ray = new Ray(origin, Vector3.Down(), 30);
    const hit = this.forge.scene.pickWithRay(ray, (mesh) => mesh !== this.body && mesh.checkCollisions);

    if (hit?.hit && hit.pickedPoint) {
      this.body.position.y = hit.pickedPoint.y + 1.53;
    }
  }

  private isGrounded(): boolean {
    const ray = new Ray(this.body.position.add(new Vector3(0, -1.34, 0)), Vector3.Down(), 0.42);
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
      this.setPrompt(`LOCKED • Clearance ${requiredClearance} required • You have ${this.clearanceLevel}`, true);
      return;
    }

    const prompt = entity.components?.Interactable?.prompt?.trim() || `E • ${entity.name}`;
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
