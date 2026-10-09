import { expect, test, type Page } from "@playwright/test";

// Browser-frame gates control genuine keyboard events and let the normal
// PlayerController, collisions, triggers and interaction radius determine
// when progress occurs. No player teleportation, script injection or test-only
// scene mutation is used in this acceptance benchmark.
async function traverse(page: Page, axis: "x" | "z", target: number, stopWhenPrompt?: string): Promise<void> {
  const viewport = page.locator("#viewport");
  const raw = await viewport.getAttribute("data-player-position");
  if (!raw) throw new Error("Missing player position");
  const coords = raw.split(",").map(Number);
  const idx = axis === "x" ? 0 : 2;
  const sign = Math.sign(target - coords[idx]);
  if (!sign || Math.abs(target - coords[idx]) < 0.3) return;

  const forwardRaw = await viewport.getAttribute("data-camera-forward");
  if (!forwardRaw) throw new Error("Missing camera direction");
  const [fx, fz] = forwardRaw.split(",").map(Number);
  const directions = [
    { key: "KeyW", dx: fx, dz: fz },
    { key: "KeyS", dx: -fx, dz: -fz },
    { key: "KeyD", dx: fz, dz: -fx },
    { key: "KeyA", dx: -fz, dz: fx }
  ];
  const desiredX = axis === "x" ? sign : 0;
  const desiredZ = axis === "z" ? sign : 0;
  const best = directions.sort(
    (a, b) => (b.dx * desiredX + b.dz * desiredZ) - (a.dx * desiredX + a.dz * desiredZ)
  )[0];
  if (best.dx * desiredX + best.dz * desiredZ < 0.9) {
    throw new Error("Echo Vault acceptance route requires cardinal camera heading");
  }

  const watch = page.evaluate(({ axis, target, sign, key, stopWhenPrompt }) => new Promise<void>((resolve, reject) => {
    const viewport = document.getElementById("viewport") as HTMLElement | null;
    const prompt = document.getElementById("interaction-prompt");
    if (!viewport) { reject(new Error("Viewport unavailable")); return; }
    const started = performance.now();
    const stop = () => window.dispatchEvent(new KeyboardEvent("keyup", {
      bubbles: true, cancelable: true, code: key, key: key.replace("Key", "").toLowerCase()
    }));
    const frame = () => {
      const raw = viewport.dataset.playerPosition ?? "";
      const xyz = raw.split(",").map(Number);
      const position = xyz[axis === "x" ? 0 : 2];
      const activePrompt = prompt?.textContent ?? "";
      if ((stopWhenPrompt && activePrompt.includes(stopWhenPrompt))
        || (Number.isFinite(position) && sign * (target - position) <= 0.26)) {
        stop(); resolve(); return;
      }
      if (performance.now() - started > 17000) {
        stop();
        reject(new Error(`WASD navigation blocked at ${axis}=${target}; pos=${raw}; prompt=${activePrompt}`));
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }), { axis, target, sign, key: best.key, stopWhenPrompt });
  await page.keyboard.down(best.key);
  try {
    await watch;
  } finally {
    await page.keyboard.up(best.key);
  }
  await expect.poll(async () => {
    const vel = await viewport.getAttribute("data-player-velocity");
    if (!vel) return Infinity;
    const [vx, , vz] = vel.split(",").map(Number);
    return Math.hypot(vx, vz);
  }, { timeout: 2800, intervals: [40, 60, 85] }).toBeLessThan(0.55);
}

test("Echo Vault power nodes, checkpoint and exit work as one real WASD playthrough", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto("/");
  await page.locator("[data-launch-tab='games']").click();
  await page.locator('#games-grid .place-card[data-place-id="official:echo-vault"] [data-action="play"]').click();
  await expect(page.locator("#output-log")).toContainText("ECHO_VAULT_READY");
  const hud = page.locator("#forge-ui-root");

  // Approach checkpoint down the central entry aisle before branching west.
  await traverse(page, "z", 11.5);
  await expect(page.locator("#output-log")).toContainText("ECHO_CHECKPOINT");

  // Power Node A: skirt the west-side storage crates and reactor.
  await traverse(page, "x", -8.0);
  await traverse(page, "z", -4.6, "Reroute power A");
  await expect(page.locator("#interaction-prompt")).toContainText("Reroute power A");
  await page.keyboard.press("KeyE");
  await expect(hud).toContainText("1 / 3 POWER NODES");

  // Escape west of A's solid collider, cross the southern service aisle,
  // then approach the west face of B without passing through it.
  await traverse(page, "x", -13.0);
  await traverse(page, "z", -12.0);
  await traverse(page, "x", -3.0);
  await traverse(page, "z", -14.1, "Reroute power B");
  await expect(page.locator("#interaction-prompt")).toContainText("Reroute power B");
  await page.keyboard.press("KeyE");
  await expect(hud).toContainText("2 / 3 POWER NODES");

  // Loop around the reactor's south side and reach the eastern relay.
  await traverse(page, "z", -11);
  await traverse(page, "x", 10);
  await traverse(page, "z", -9.5, "Reroute power C");
  await expect(page.locator("#interaction-prompt")).toContainText("Reroute power C");
  await page.keyboard.press("KeyE");
  await expect(hud).toContainText("3 / 3 POWER NODES");
  await expect(page.locator("#output-log")).toContainText("ECHO_VAULT_UNLOCKED");

  // The exit is reachable only once all three power nodes unlock the door.
  await traverse(page, "z", -21);
  await traverse(page, "x", 0);
  await traverse(page, "z", -29);
  await expect(page.locator("#output-log")).toContainText("ECHO_VAULT_WIN");
  await expect(hud).toContainText("MISSION COMPLETE");
  await expect(page.locator("#viewport")).toHaveAttribute("data-player-dead", "false");
});
