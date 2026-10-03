import { Animation, Color3, StandardMaterial, Vector3 } from "@babylonjs/core";
import type { ScriptRuntime } from "./ScriptRuntime";

export function registerDefaultScripts(runtime: ScriptRuntime): void {
  runtime.register("door.basic", ({ entity, node, scene, log }) => {
    const closedY = node.position.y;
    const travel = entity.components?.Door?.openHeight ?? 4;
    let open = false;
    let busy = false;

    return {
      onInteract() {
        if (busy) return;
        busy = true;

        const start = node.position.y;
        const end = open ? closedY : closedY + travel;
        const animation = new Animation(
          `${entity.id}-slide`,
          "position.y",
          60,
          Animation.ANIMATIONTYPE_FLOAT,
          Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        animation.setKeys([
          { frame: 0, value: start },
          { frame: 28, value: end }
        ]);

        scene.beginDirectAnimation(node, [animation], 0, 28, false, 1, () => {
          open = !open;
          busy = false;
          log(`${entity.name}: ${open ? "OPEN" : "CLOSED"}`);
        });
      }
    };
  });

  runtime.register("reactor.pulse", ({ node }) => {
    const material = node.material instanceof StandardMaterial ? node.material : null;
    const base = Color3.FromHexString("#6fe8ff");
    let elapsed = 0;

    return {
      onUpdate(dt) {
        elapsed += dt;
        if (material) {
          const pulse = 0.55 + Math.sin(elapsed * 2.2) * 0.2;
          material.emissiveColor = base.scale(pulse);
        }
        node.rotation.y += dt * 0.16;
      }
    };
  });

  runtime.register("console.status", ({ entity, node, log }) => ({
    onInteract() {
      log(`${entity.name}: SYSTEM NOMINAL • reactor link online`);
      node.scaling = new Vector3(1.03, 1.03, 1.03);
      window.setTimeout(() => {
        node.scaling = Vector3.One();
      }, 120);
    }
  }));
}
