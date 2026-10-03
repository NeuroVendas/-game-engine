import { PointerDragBehavior } from "@babylonjs/core/Behaviors/Meshes/pointerDragBehavior";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";

type AxisSpec = {
  axis: Vector3;
  color: Color3;
  rotation: Vector3;
};

export class SixAxisMoveGizmo {
  private readonly root: TransformNode;
  private target: AbstractMesh | null = null;
  private enabled = false;
  private snapDistance = 0;

  constructor(private readonly scene: Scene) {
    this.root = new TransformNode("__forge-six-axis-move", scene);

    const axes: AxisSpec[] = [
      { axis: new Vector3(1, 0, 0), color: new Color3(0.92, 0.2, 0.2), rotation: new Vector3(0, 0, -Math.PI / 2) },
      { axis: new Vector3(-1, 0, 0), color: new Color3(0.92, 0.2, 0.2), rotation: new Vector3(0, 0, Math.PI / 2) },
      { axis: new Vector3(0, 1, 0), color: new Color3(0.28, 0.82, 0.3), rotation: Vector3.Zero() },
      { axis: new Vector3(0, -1, 0), color: new Color3(0.28, 0.82, 0.3), rotation: new Vector3(0, 0, Math.PI) },
      { axis: new Vector3(0, 0, 1), color: new Color3(0.18, 0.46, 1), rotation: new Vector3(Math.PI / 2, 0, 0) },
      { axis: new Vector3(0, 0, -1), color: new Color3(0.18, 0.46, 1), rotation: new Vector3(-Math.PI / 2, 0, 0) }
    ];

    for (const spec of axes) this.createArrow(spec);
    this.root.setEnabled(false);
  }

  setTarget(target: AbstractMesh | null): void {
    this.target = target;
    if (target) this.root.position.copyFrom(target.getAbsolutePosition());
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.root.setEnabled(enabled && Boolean(this.target));
  }

  setSnapDistance(distance: number): void {
    this.snapDistance = Math.max(0, distance);
  }

  update(cameraPosition: Vector3): void {
    if (!this.target || !this.enabled) return;
    this.root.position.copyFrom(this.target.getAbsolutePosition());
    const distance = Vector3.Distance(cameraPosition, this.root.position);
    const scale = Math.min(3.2, Math.max(0.75, distance * 0.045));
    this.root.scaling.setAll(scale);
  }

  private createArrow(spec: AxisSpec): void {
    const holder = new TransformNode("__move-arrow", this.scene);
    holder.parent = this.root;
    holder.rotation = spec.rotation;

    const material = new StandardMaterial("__move-arrow-mat", this.scene);
    material.diffuseColor = spec.color;
    material.emissiveColor = spec.color.scale(0.22);
    material.specularColor = Color3.Black();

    const shaft = MeshBuilder.CreateCylinder("__move-shaft", {
      height: 1.35,
      diameter: 0.10,
      tessellation: 12
    }, this.scene);
    shaft.parent = holder;
    shaft.position.y = 0.675;
    shaft.material = material;
    shaft.renderingGroupId = 3;

    const head = MeshBuilder.CreateCylinder("__move-head", {
      height: 0.42,
      diameterTop: 0,
      diameterBottom: 0.34,
      tessellation: 16
    }, this.scene);
    head.parent = holder;
    head.position.y = 1.55;
    head.material = material;
    head.renderingGroupId = 3;

    this.attachDrag(shaft, spec.axis);
    this.attachDrag(head, spec.axis);
  }

  private attachDrag(mesh: Mesh, axis: Vector3): void {
    const drag = new PointerDragBehavior({ dragAxis: axis });
    drag.moveAttached = false;
    drag.updateDragPlane = false;

    drag.onDragObservable.add((event) => {
      if (!this.target || !this.enabled) return;

      this.target.position.addInPlace(event.delta);

      if (this.snapDistance > 0) {
        if (Math.abs(axis.x) > 0.5) {
          this.target.position.x = Math.round(this.target.position.x / this.snapDistance) * this.snapDistance;
        }
        if (Math.abs(axis.y) > 0.5) {
          this.target.position.y = Math.round(this.target.position.y / this.snapDistance) * this.snapDistance;
        }
        if (Math.abs(axis.z) > 0.5) {
          this.target.position.z = Math.round(this.target.position.z / this.snapDistance) * this.snapDistance;
        }
      }

      this.root.position.copyFrom(this.target.getAbsolutePosition());
    });

    mesh.addBehavior(drag);
  }
}
