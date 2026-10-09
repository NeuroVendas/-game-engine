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
  private jumpCount = 0;
  private grounded = false;
  private firstPerson = false;
  private interactPressed = false;
  private walkTime = 0;
  private clearanceLevel = 1;
  private landingCompression = 0;
  private sprintBlend = 0;
  private thirdPersonRadius = 6;
  private cameraCollisionGrace = 0;
  private readonly thirdPersonMinRadius = 2.35;
  private readonly thirdPersonMaxRadius = 11.5;
  private colliderHeight = 3.05;
  private colliderRadius = 0.45;
  private walkSpeed = 5.05;
  private runSpeed = 8.0;
  private jumpPower = 7.9;
  private checkpointPosition = Vector3.Zero();
  private maxHealth = 100;
  private health = 100;
  private autoRespawn = true;
  private dead = false;
  private deathTimer = 0;
  private killY = -100;

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ShiftLeft", "ShiftRight"].includes(event.code)) {
      event.preventDefault();
    }

    this.keys.add(event.code);

    if (event.code === "Space" && !event.repeat) {
      this.jumpBuffer = 0.24;
    }

    if (event.code === "KeyC" && !event.repeat) {
      if (!this.firstPerson) {
        // Capture the actual visible zoom immediately before the mode switch.
        // Collision handling is suspended across the first-person transition,
        // so that returning to third-person cannot snap through the avatar.
        this.thirdPersonRadius = Math.min(
          this.thirdPersonMaxRadius,
          Math.max(this.thirdPersonMinRadius, this.camera.radius)
        );
        this.firstPerson = true;
        this.cameraCollisionGrace = 0;
        // First-person starts within the player's collider; avoid self-collision.
        this.camera.checkCollisions = false;
        this.camera.lowerRadiusLimit = 0.35;
        this.camera.upperRadiusLimit = 0.6;
        this.camera.radius = 0.45;
      } else {
        this.firstPerson = false;
        this.camera.lowerRadiusLimit = this.thirdPersonMinRadius;
        this.camera.upperRadiusLimit = this.thirdPersonMaxRadius;
        // Restore the chosen zoom before allowing collisions to adjust the camera.
        // This prevents a collision while crossing the player capsule at radius 0.45.
        this.camera.checkCollisions = false;
        this.cameraCollisionGrace = 0.4;
        this.camera.radius = this.thirdPersonRadius;
      }

      this.avatarRoot.setEnabled(!this.firstPerson);
      this.forge.canvas.dataset.cameraMode = this.firstPerson ? "first-person" : "third-person";
      this.forge.canvas.dataset.cameraRadius = this.camera.radius.toFixed(3);
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
    private readonly setPrompt: (text: string | null, locked: boolean) => void = () => {},
    config: {
      colliderHeight?: number;
      colliderRadius?: number;
      walkSpeed?: number;
      runSpeed?: number;
      jumpPower?: number;
      maxHealth?: number;
      autoRespawn?: boolean;
      killY?: number;
    } = {}
  ) {
    const scene = forge.scene;

    this.colliderRadius = Math.min(2, Math.max(0.2, Number(config.colliderRadius) || 0.45));
    const requestedHeight = Math.min(8, Math.max(1, Number(config.colliderHeight) || 3.05));
    this.colliderHeight = Math.max(requestedHeight, this.colliderRadius * 2.1);
    this.walkSpeed = Math.min(20, Math.max(1, Number(config.walkSpeed) || 5.05));
    this.runSpeed = Math.min(30, Math.max(this.walkSpeed, Number(config.runSpeed) || 8.0));
    this.jumpPower = Math.min(20, Math.max(1, Number(config.jumpPower) || 7.9));
    this.maxHealth = Math.min(100000, Math.max(1, Number(config.maxHealth) || 100));
    this.health = this.maxHealth;
    this.autoRespawn = config.autoRespawn ?? true;
    const requestedKillY = Number(config.killY);
    this.killY = Number.isFinite(requestedKillY)
      ? Math.min(100000, Math.max(-100000, requestedKillY))
      : -100;

    this.body = MeshBuilder.CreateCapsule("__player-collider", {
      height: this.colliderHeight,
      radius: this.colliderRadius,
      subdivisions: 8
    }, scene);
    this.body.position = new Vector3(spawn[0], spawn[1], spawn[2]);
    this.body.checkCollisions = true;
    this.body.ellipsoid = new Vector3(
      this.colliderRadius * 1.155,
      this.colliderHeight * 0.485,
      this.colliderRadius * 1.155
    );
    this.body.ellipsoidOffset = Vector3.Zero();
    this.body.isPickable = false;
    this.body.visibility = 0;

    this.snapToSafeGround();
    this.checkpointPosition.copyFrom(this.body.position);
    this.syncCheckpointDiagnostics();

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
    this.camera.lowerRadiusLimit = this.thirdPersonMinRadius;
    this.camera.upperRadiusLimit = this.thirdPersonMaxRadius;
    this.camera.lowerBetaLimit = 0.34;
    this.camera.upperBetaLimit = 1.46;
    this.camera.panningSensibility = 0;
    this.camera.wheelPrecision = 28;
    this.camera.inertia = 0.72;
    this.camera.angularSensibilityX = 2600;
    this.camera.angularSensibilityY = 2600;
    this.camera.fov = 0.82;
    this.camera.checkCollisions = true;
    this.camera.collisionRadius = new Vector3(0.25, 0.25, 0.25);
    this.camera.attachControl(forge.canvas, true);
    scene.activeCamera = this.camera;

    forge.canvas.dataset.avatarRig = "ForgeClassic6";
    forge.canvas.dataset.avatarShape = "block-head-equal-limbs";
    forge.canvas.dataset.avatarAnimation = "idle";
    forge.canvas.dataset.cameraMode = "third-person";
    forge.canvas.dataset.playerColliderHeight = this.colliderHeight.toFixed(3);
    forge.canvas.dataset.playerColliderRadius = this.colliderRadius.toFixed(3);
    forge.canvas.dataset.playerWalkSpeed = this.walkSpeed.toFixed(3);
    forge.canvas.dataset.playerRunSpeed = this.runSpeed.toFixed(3);
    forge.canvas.dataset.playerJumpPower = this.jumpPower.toFixed(3);
    forge.canvas.dataset.playerKillY = this.killY.toFixed(3);
    this.syncHealthDiagnostics();
    this.forge.canvas.dataset.playerJumpCount = "0";

    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);

    this.log("Play: WASD move • drag mouse to look • wheel zoom • Shift run • Space jump • E interact");
  }

  update(dt: number): void {
    if (this.dead) {
      this.horizontalVelocity.copyFromFloats(0, 0, 0);
      this.verticalVelocity = 0;
      this.jumpBuffer = 0;
      this.coyoteTime = 0;

      if (this.autoRespawn) {
        this.deathTimer = Math.max(0, this.deathTimer - dt);
        if (this.deathTimer <= 0) this.respawn();
      }

      this.forge.canvas.dataset.playerMovementState = this.dead ? "dead" : "idle";
      return;
    }

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

    const wasGrounded = this.grounded;
    const landingVelocity = this.verticalVelocity;
    this.grounded = this.isGrounded();

    if (this.grounded && !wasGrounded && landingVelocity < -2.8) {
      this.landingCompression = Math.min(0.12, Math.abs(landingVelocity) * 0.012);
    }

    this.coyoteTime = this.grounded ? 0.12 : Math.max(0, this.coyoteTime - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    if (this.grounded && this.verticalVelocity < 0) {
      this.verticalVelocity = -0.35;
    }

    if (this.jumpBuffer > 0 && this.coyoteTime > 0) {
      this.verticalVelocity = this.jumpPower;
      this.jumpCount += 1;
      this.forge.canvas.dataset.playerJumpCount = String(this.jumpCount);
      this.forge.canvas.dataset.lastPlayerJumpImpulse = this.verticalVelocity.toFixed(3);
      this.jumpBuffer = 0;
      this.coyoteTime = 0;
      this.grounded = false;
    }

    this.sprintBlend += ((running ? 1 : 0) - this.sprintBlend) * Math.min(1, dt * 7.5);

    const targetSpeed = running ? this.runSpeed : this.walkSpeed;
    const targetVelocity = moving
      ? desiredDirection.scale(targetSpeed)
      : Vector3.Zero();

    const acceleration = this.grounded
      ? (moving ? (running ? 20.5 : 22.5) : 33)
      : (moving ? 7.4 : 9.2);

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

    if (this.body.position.y < this.killY && !this.dead) {
      this.damage(this.maxHealth);
      this.forge.canvas.dataset.lastPlayerAction = "fall-death";
    }

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

    this.landingCompression += (0 - this.landingCompression) * Math.min(1, dt * 12);

    if (!this.firstPerson) {
      this.thirdPersonRadius = Math.min(
        this.thirdPersonMaxRadius,
        Math.max(this.thirdPersonMinRadius, this.camera.radius)
      );
    }

    if (!this.firstPerson && this.cameraCollisionGrace > 0) {
      this.cameraCollisionGrace = Math.max(0, this.cameraCollisionGrace - dt);
      if (this.cameraCollisionGrace === 0) this.camera.checkCollisions = true;
    }

    const desiredFov = this.firstPerson ? 0.79 : 0.82 + this.sprintBlend * 0.045;
    this.camera.fov += (desiredFov - this.camera.fov) * Math.min(1, dt * 5.5);

    const desiredCameraTarget = this.body.position.add(
      new Vector3(0, 0.54 - this.landingCompression * 0.35, 0)
    );
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
    this.forge.canvas.dataset.cameraForward = [
      forward.x.toFixed(4),
      forward.z.toFixed(4)
    ].join(",");
    this.forge.canvas.dataset.cameraRadius = this.camera.radius.toFixed(3);
    this.forge.canvas.dataset.cameraFov = this.camera.fov.toFixed(4);
    this.forge.canvas.dataset.playerMovementState =
      !this.grounded ? "air" : running ? "sprint" : moving ? "walk" : "idle";

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

  getHealth(): number {
    return this.health;
  }

  getMaxHealth(): number {
    return this.maxHealth;
  }

  isDead(): boolean {
    return this.dead;
  }

  damage(amount: number): number {
    if (this.dead) return this.health;
    const damage = Math.max(0, Number(amount) || 0);
    if (damage <= 0) return this.health;

    this.health = Math.max(0, this.health - damage);
    this.forge.canvas.dataset.lastPlayerAction = `damage:${damage.toFixed(2)}`;

    if (this.health <= 0) {
      this.dead = true;
      this.deathTimer = 0.85;
      this.keys.clear();
      this.horizontalVelocity.copyFromFloats(0, 0, 0);
      this.verticalVelocity = 0;
      this.forge.canvas.dataset.lastPlayerAction =
        this.autoRespawn ? "death:auto-respawn" : "death";
    }

    this.syncHealthDiagnostics();
    return this.health;
  }

  heal(amount: number): number {
    if (this.dead) return this.health;
    const healing = Math.max(0, Number(amount) || 0);
    if (healing <= 0) return this.health;

    this.health = Math.min(this.maxHealth, this.health + healing);
    this.forge.canvas.dataset.lastPlayerAction = `heal:${healing.toFixed(2)}`;
    this.syncHealthDiagnostics();
    return this.health;
  }

  private syncHealthDiagnostics(): void {
    this.forge.canvas.dataset.playerHealth =
      `${this.health.toFixed(3)},${this.maxHealth.toFixed(3)}`;
    this.forge.canvas.dataset.playerDead = String(this.dead);
  }

  setCheckpoint(idOrName?: string): boolean {
    let checkpoint = this.body.position.clone();

    if (idOrName?.trim()) {
      const entity = this.forge.document.entities.find(
        (candidate) => candidate.id === idOrName || candidate.name === idOrName
      );
      if (!entity) return false;
      const mesh = this.forge.getMesh(entity.id);
      if (!mesh) return false;
      const position = mesh.getAbsolutePosition();
      checkpoint = new Vector3(
        position.x,
        position.y + this.colliderHeight / 2,
        position.z
      );
    }

    this.checkpointPosition.copyFrom(checkpoint);
    this.syncCheckpointDiagnostics();
    this.forge.canvas.dataset.lastPlayerAction =
      `checkpoint:${idOrName?.trim() || "current"}`;
    return true;
  }

  respawn(): boolean {
    if (!Number.isFinite(this.checkpointPosition.x)) return false;

    this.dead = false;
    this.deathTimer = 0;
    this.health = this.maxHealth;
    this.keys.clear();
    this.horizontalVelocity.copyFromFloats(0, 0, 0);
    this.verticalVelocity = 0;
    this.jumpBuffer = 0;
    this.coyoteTime = 0;
    this.body.position.copyFrom(this.checkpointPosition);
    this.body.computeWorldMatrix(true);

    this.camera.target.copyFrom(
      this.body.position.add(new Vector3(0, 0.54, 0))
    );

    this.forge.canvas.dataset.playerPosition = [
      this.body.position.x.toFixed(3),
      this.body.position.y.toFixed(3),
      this.body.position.z.toFixed(3)
    ].join(",");
    this.forge.canvas.dataset.lastPlayerAction = "respawn";
    this.syncHealthDiagnostics();
    return true;
  }

  private syncCheckpointDiagnostics(): void {
    this.forge.canvas.dataset.playerCheckpoint = [
      this.checkpointPosition.x.toFixed(3),
      this.checkpointPosition.y.toFixed(3),
      this.checkpointPosition.z.toFixed(3)
    ].join(",");
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
    delete this.forge.canvas.dataset.cameraForward;
    delete this.forge.canvas.dataset.cameraRadius;
    delete this.forge.canvas.dataset.cameraFov;
    delete this.forge.canvas.dataset.cameraMode;
    delete this.forge.canvas.dataset.playerColliderHeight;
    delete this.forge.canvas.dataset.playerColliderRadius;
    delete this.forge.canvas.dataset.playerWalkSpeed;
    delete this.forge.canvas.dataset.playerRunSpeed;
    delete this.forge.canvas.dataset.playerJumpPower;
    delete this.forge.canvas.dataset.playerKillY;
    delete this.forge.canvas.dataset.playerCheckpoint;
    delete this.forge.canvas.dataset.playerHealth;
    delete this.forge.canvas.dataset.playerDead;
    delete this.forge.canvas.dataset.lastPlayerAction;
    delete this.forge.canvas.dataset.playerMovementState;
    delete this.forge.canvas.dataset.avatarRig;
    delete this.forge.canvas.dataset.avatarShape;
    delete this.forge.canvas.dataset.avatarAnimation;
    delete this.forge.canvas.dataset.playerJumpCount;
    delete this.forge.canvas.dataset.lastPlayerJumpImpulse;

    for (const part of this.avatarParts) {
      this.forge.unregisterShadowCaster(part, false);
      part.dispose();
    }
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
    head.receiveShadows = true;
    this.forge.registerShadowCaster(head, false);
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
    part.receiveShadows = true;
    this.forge.registerShadowCaster(part, false);
    this.avatarParts.push(part);
    return part;
  }

  private animateClassicWalk(dt: number, running: boolean): void {
    const cadence = running ? 9.4 : 6.6;
    const amplitude = running ? 0.72 : 0.52;

    this.walkTime += dt * cadence;
    const swing = Math.sin(this.walkTime) * amplitude;
    const bob = Math.abs(Math.sin(this.walkTime * 2)) * (running ? 0.042 : 0.025);
    const bodyLean = running ? -0.065 : -0.025;

    this.easeRotation(this.armPivots[0], swing, dt, 14);
    this.easeRotation(this.armPivots[1], -swing, dt, 14);
    this.easeRotation(this.legPivots[0], -swing * 0.9, dt, 15);
    this.easeRotation(this.legPivots[1], swing * 0.9, dt, 15);

    const wantedY = bob - this.landingCompression;
    this.avatarRoot.position.y += (wantedY - this.avatarRoot.position.y) * Math.min(1, dt * 17);
    this.avatarRoot.rotation.x += (bodyLean - this.avatarRoot.rotation.x) * Math.min(1, dt * 9);
    this.headPivot.rotation.z += (
      Math.sin(this.walkTime) * (running ? 0.018 : 0.012) - this.headPivot.rotation.z
    ) * Math.min(1, dt * 12);
    this.forge.canvas.dataset.avatarAnimation = running ? "run" : "walk";
  }

  private animateIdle(dt: number): void {
    this.walkTime += dt * 0.9;
    this.easeRotation(this.armPivots[0], 0, dt, 10);
    this.easeRotation(this.armPivots[1], 0, dt, 10);
    this.easeRotation(this.legPivots[0], 0, dt, 10);
    this.easeRotation(this.legPivots[1], 0, dt, 10);

    const breathe = Math.sin(this.walkTime) * 0.008;
    const wantedY = breathe - this.landingCompression;
    this.avatarRoot.position.y += (wantedY - this.avatarRoot.position.y) * Math.min(1, dt * 10);
    this.avatarRoot.rotation.x += (0 - this.avatarRoot.rotation.x) * Math.min(1, dt * 9);
    this.headPivot.rotation.z += (0 - this.headPivot.rotation.z) * Math.min(1, dt * 8);
    this.forge.canvas.dataset.avatarAnimation = "idle";
  }

  private animateJump(dt: number): void {
    const rising = this.verticalVelocity > 0;
    this.easeRotation(this.armPivots[0], rising ? -0.22 : -0.08, dt, 11);
    this.easeRotation(this.armPivots[1], rising ? -0.22 : -0.08, dt, 11);
    this.easeRotation(this.legPivots[0], rising ? 0.14 : 0.24, dt, 11);
    this.easeRotation(this.legPivots[1], rising ? -0.14 : -0.24, dt, 11);
    this.avatarRoot.position.y += (0.02 - this.avatarRoot.position.y) * Math.min(1, dt * 10);
    this.avatarRoot.rotation.x += ((rising ? -0.04 : 0.035) - this.avatarRoot.rotation.x)
      * Math.min(1, dt * 8);
    this.forge.canvas.dataset.avatarAnimation = rising ? "jump-rise" : "jump-fall";
  }

  private easeRotation(node: TransformNode, targetX: number, dt: number, speed: number): void {
    node.rotation.x += (targetX - node.rotation.x) * Math.min(1, dt * speed);
  }

  private snapToSafeGround(): void {
    const origin = new Vector3(this.body.position.x, this.body.position.y + 12, this.body.position.z);
    const ray = new Ray(origin, Vector3.Down(), 30);
    const hit = this.forge.scene.pickWithRay(ray, (mesh) => mesh !== this.body && mesh.checkCollisions);

    if (hit?.hit && hit.pickedPoint) {
      this.body.position.y = hit.pickedPoint.y + this.colliderHeight / 2;
    }
  }

  private isGrounded(): boolean {
    const groundProbeY = -(this.colliderHeight / 2 - 0.2);
    const ray = new Ray(this.body.position.add(new Vector3(0, groundProbeY, 0)), Vector3.Down(), 0.45);
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
