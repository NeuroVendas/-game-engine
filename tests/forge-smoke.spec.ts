import { expect, test } from "@playwright/test";

test("launcher opens first and Helios enters a working Play mode", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("#launcher")).toBeVisible();
  await expect(page.locator("#app")).toBeHidden();
  await expect(page.locator(".launcher-heading h1")).toHaveText("My Places");

  await page.locator("[data-open-helios]").first().click();

  await expect(page.locator("#app")).toBeVisible();
  await expect(page.locator("#launcher")).toBeHidden();
  await expect(page.locator("#scene-tree")).toContainText("Facility Floor");

  const canvas = page.locator("#viewport");
  await expect(canvas).toBeVisible();

  await page.locator("#play").click();
  await expect(page.locator("#mode-badge")).toHaveText("PLAY");
  await expect(page.locator("#stop")).toBeEnabled();

  const pointerLocked = await page.evaluate(() => document.pointerLockElement !== null);
  expect(pointerLocked).toBe(false);

  await page.waitForTimeout(800);
  const runtimeError = await canvas.getAttribute("data-runtime-error");
  const statusText = await page.locator("#status").textContent();
  const fpsText = await page.locator("#fps").textContent();
  console.log("PLAY DEBUG", { runtimeError, statusText, fpsText });

  expect(runtimeError).toBeNull();
  await expect.poll(async () => canvas.getAttribute("data-player-position")).not.toBeNull();
  await expect(canvas).toHaveAttribute("data-avatar-rig", "ForgeClassic6");
  const before = (await canvas.getAttribute("data-player-position"))!;

  await page.keyboard.down("KeyW");
  await page.waitForTimeout(650);
  await page.keyboard.up("KeyW");
  await page.waitForTimeout(100);

  const after = (await canvas.getAttribute("data-player-position"))!;
  expect(after).not.toBe(before);

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const cx = box.x + box.width * 0.55;
  const cy = box.y + box.height * 0.5;
  const cameraBefore = (await canvas.getAttribute("data-camera-angles"))!;

  await page.mouse.move(cx, cy);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(cx + 100, cy + 30, { steps: 5 });
  await page.mouse.up({ button: "right" });
  await page.waitForTimeout(100);

  const cameraAfter = (await canvas.getAttribute("data-camera-angles"))!;
  expect(cameraAfter).not.toBe(cameraBefore);

  await page.locator("#stop").click();
  await expect(page.locator("#mode-badge")).toHaveText("EDITOR");
});

test("custom place creation opens a blank editable project", async ({ page }) => {
  await page.goto("/");
  await page.locator("#new-place").click();
  await expect(page.locator("#create-place-dialog")).toBeVisible();

  await page.locator("#new-place-name").fill("Smoke Test Place");
  await page.locator("#confirm-create-place").click();

  await expect(page.locator("#app")).toBeVisible();
  await expect(page.locator("#studio-project-name")).toHaveText("Smoke Test Place");
  await expect(page.locator("#scene-tree")).toContainText("Baseplate");

  await page.locator(".scene-item", { hasText: "Baseplate" }).click();
  await page.locator("#code-selected").click();
  await expect(page.locator("#script-editor-dialog")).toBeVisible();

  await page.locator("#script-name").fill("smoke.custom");
  await page.locator("#script-source").fill(`
let fired = false;
Forge.onUpdate(() => {
  if (fired) return;
  fired = true;
  Forge.log("SMOKE_SCRIPT_OK");
});
`);
  await page.locator("#script-save").click();
  await page.locator("#script-close").click();

  await page.locator("#play").click();
  await expect(page.locator("#mode-badge")).toHaveText("PLAY");
  await expect.poll(async () => page.locator("#status").textContent()).toContain("SMOKE_SCRIPT_OK");

  const runtimeError = await page.locator("#viewport").getAttribute("data-runtime-error");
  expect(runtimeError).toBeNull();

  await page.locator("#stop").click();
});
