test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => console.log("PAGE_ERROR:", error.message));
  page.on("console", (message) => {
    if (message.type() === "error") console.log("BROWSER_ERROR:", message.text());
  });
});

function makeTriangleGlb(): Buffer {
  const binary = Buffer.alloc(44);
  const positions = [
    0, 0, 0,
    1, 0, 0,
    0, 1, 0
  ];
  positions.forEach((value, index) => binary.writeFloatLE(value, index * 4));
  binary.writeUInt16LE(0, 36);
  binary.writeUInt16LE(1, 38);
  binary.writeUInt16LE(2, 40);

  const json = JSON.stringify({
    asset: { version: "2.0" },
    buffers: [{ byteLength: 44 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: 36, byteLength: 6, target: 34963 }
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [0, 0, 0],
        max: [1, 1, 0]
      },
      {
        bufferView: 1,
        componentType: 5123,
        count: 3,
        type: "SCALAR",
        min: [0],
        max: [2]
      }
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0
  });

  const jsonRaw = Buffer.from(json, "utf8");
  const jsonLength = Math.ceil(jsonRaw.length / 4) * 4;
  const jsonChunk = Buffer.alloc(jsonLength, 0x20);
  jsonRaw.copy(jsonChunk);

  const totalLength = 12 + 8 + jsonChunk.length + 8 + binary.length;
  const glb = Buffer.alloc(totalLength);
  let offset = 0;

  glb.writeUInt32LE(0x46546c67, offset); offset += 4;
  glb.writeUInt32LE(2, offset); offset += 4;
  glb.writeUInt32LE(totalLength, offset); offset += 4;

  glb.writeUInt32LE(jsonChunk.length, offset); offset += 4;
  glb.writeUInt32LE(0x4e4f534a, offset); offset += 4;
  jsonChunk.copy(glb, offset); offset += jsonChunk.length;

  glb.writeUInt32LE(binary.length, offset); offset += 4;
  glb.writeUInt32LE(0x004e4942, offset); offset += 4;
  binary.copy(glb, offset);

  return glb;
}

function makeSilentWav(): Buffer {
  const sampleRate = 8000;
  const samples = 400;
  const dataSize = samples * 2;
  const wav = Buffer.alloc(44 + dataSize);

  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write("WAVE", 8);
  wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(dataSize, 40);

  return wav;
}

import { expect, test } from "@playwright/test";

test("platform home, games, favorites, profile and direct play work", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("#launcher-page-home")).toBeVisible();
  await expect(page.locator("#app")).toBeHidden();

  await expect.poll(async () => page.locator("#cloud-status").textContent()).toContain("Forge Cloud Online");
  await expect.poll(async () => page.locator("#launcher").getAttribute("data-cloud-catalog-count")).toBe("1");
  await expect(page.locator("#launcher")).toHaveAttribute("data-cloud-session", "guest");

  await page.locator("#account-button").click();
  await expect(page.locator("#auth-dialog")).toBeVisible();
  await expect(page.locator("#auth-message")).toContainText("guest");
  await page.locator("#auth-guest").click();
  await expect(page.locator("#auth-dialog")).toBeHidden();

  await page.locator("[data-launch-tab='friends']").click();
  await expect(page.locator("#friends-guest")).toBeVisible();
  await page.locator("#friends-sign-in").click();
  await expect(page.locator("#auth-dialog")).toBeVisible();
  await page.locator("#auth-guest").click();

  await page.locator("[data-launch-tab='games']").click();
  await expect(page.locator("#launcher-page-games")).toBeVisible();
  await expect(page.locator("#games-grid .place-card")).toHaveCount(1);

  const heliosCard = page.locator("#games-grid .place-card").first();
  await heliosCard.click({ position: { x: 50, y: 40 } });
  await expect(page.locator("#game-details-dialog")).toBeVisible();
  await expect(page.locator("#game-detail-title")).toHaveText("Project Helios");
  await expect(page.locator("#game-detail-creator")).toHaveText("Forge");
  await expect(page.locator("#game-detail-share-url")).toHaveValue(/#game\/project-helios$/);
  await page.locator("#game-detail-close").click();

  await page.evaluate(() => {
    location.hash = "#game/project-helios";
  });
  await expect(page.locator("#game-details-dialog")).toBeVisible();
  await expect(page.locator("#game-detail-title")).toHaveText("Project Helios");
  await page.locator("#game-detail-close").click();

  await heliosCard.locator("[data-action='favorite']").click();
  await expect(page.locator("#favorite-count")).toHaveText("1");

  await heliosCard.locator("[data-action='play']").click();
  await expect(page.locator("#app")).toBeVisible();
  await expect(page.locator("#app")).toHaveClass(/game-session/);
  await page.waitForTimeout(300);
  console.log("EDITOR_INIT_ERROR:", await page.locator("#viewport").getAttribute("data-editor-init-error"));
  await expect(page.locator("#mode-badge")).toHaveText("PLAY");

  const canvas = page.locator("#viewport");
  await expect.poll(async () => canvas.getAttribute("data-player-position")).not.toBeNull();
  const before = (await canvas.getAttribute("data-player-position"))!;

  await page.keyboard.down("KeyW");
  await page.waitForTimeout(90);
  const earlyVelocityRaw = (await canvas.getAttribute("data-player-velocity"))!;
  const earlyVelocity = Math.hypot(
    Number(earlyVelocityRaw.split(",")[0]),
    Number(earlyVelocityRaw.split(",")[2])
  );
  expect(earlyVelocity).toBeGreaterThan(0.2);
  expect(earlyVelocity).toBeLessThan(4.8);

  await page.waitForTimeout(410);
  const fullVelocityRaw = (await canvas.getAttribute("data-player-velocity"))!;
  const fullVelocity = Math.hypot(
    Number(fullVelocityRaw.split(",")[0]),
    Number(fullVelocityRaw.split(",")[2])
  );
  expect(fullVelocity).toBeGreaterThan(earlyVelocity);

  await page.keyboard.up("KeyW");
  await page.waitForTimeout(220);
  const after = (await canvas.getAttribute("data-player-position"))!;
  expect(after).not.toBe(before);

  const stoppedVelocityRaw = (await canvas.getAttribute("data-player-velocity"))!;
  const stoppedVelocity = Math.hypot(
    Number(stoppedVelocityRaw.split(",")[0]),
    Number(stoppedVelocityRaw.split(",")[2])
  );
  expect(stoppedVelocity).toBeLessThan(fullVelocity);

  await page.keyboard.press("Space");
  await expect.poll(async () => {
    const velocity = await canvas.getAttribute("data-player-velocity");
    return velocity ? Number(velocity.split(",")[1]) : -999;
  }).toBeGreaterThan(0.5);

  await page.locator("#exit-game").click();
  await expect(page.locator("#launcher-page-games")).toBeVisible();
  await expect(page.locator("#app")).toBeHidden();

  await page.reload();
  await expect.poll(async () => page.locator("#cloud-status").textContent()).toContain("Forge Cloud Online");
  await page.locator("[data-launch-tab='favorites']").click();
  await expect(page.locator("#favorites-grid .place-card")).toHaveCount(1);
});

test("develop can create, edit, duplicate, rename, delete and persist a place", async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-launch-tab='develop']").click();
  await expect(page.locator("#launcher-page-develop")).toBeVisible();

  await page.locator("#new-place").click();
  await page.locator("#new-place-name").fill("Menu Test Place");
  await page.locator("#confirm-create-place").click();

  await expect(page.locator("#app")).toBeVisible();
  await expect(page.locator("#studio-project-name")).toHaveText("Menu Test Place");
  await expect(page.locator("#scene-tree")).toContainText("Baseplate");

  await page.locator("#home-button").click();
  await expect(page.locator("#launcher-page-develop")).toBeVisible();

  await page.reload();
  await page.locator("[data-launch-tab='develop']").click();
  await expect(page.locator("#launcher-page-develop")).toBeVisible();

  const card = page.locator("#game-grid .place-card[data-place-name='Menu Test Place']");
  await expect(card).toHaveCount(1);

  await card.click({ position: { x: 55, y: 45 } });
  await expect(page.locator("#game-details-dialog")).toBeVisible();
  await page.locator("#game-detail-description").fill("A local menu smoke-test place.");
  await page.locator("#game-detail-save").click();
  await expect(page.locator("#game-detail-description")).toHaveValue("A local menu smoke-test place.");
  await page.locator("#game-detail-close").click();

  await card.locator("[data-action='more']").click();
  await card.locator("[data-action='duplicate']").click();
  await expect(page.locator("#game-grid")).toContainText("Menu Test Place Copy");

  const original = page.locator("#game-grid .place-card[data-place-name='Menu Test Place']");
  await original.locator("[data-action='more']").click();
  await original.locator("[data-action='rename']").click();
  await page.locator("#rename-place-name").fill("Renamed Place");
  await page.locator("#confirm-rename-place").click();
  await expect(page.locator("#game-grid")).toContainText("Renamed Place");

  const renamed = page.locator("#game-grid .place-card[data-place-name='Renamed Place']");
  await renamed.locator("[data-action='more']").click();
  page.once("dialog", (dialog) => dialog.accept());
  await renamed.locator("[data-action='delete']").click();
  await expect(page.locator("#game-grid")).not.toContainText("Renamed Place");
});

test("studio scripting and play remain functional", async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-launch-tab='develop']").click();
  await page.locator("#new-place").click();
  await page.locator("#new-place-name").fill("Script Place");
  await page.locator("#confirm-create-place").click();

  await page.locator(".scene-item", { hasText: "Baseplate" }).click();
  await page.locator("#code-selected").click();
  await page.locator("#script-source").fill(`
let fired = false;

Forge.onStart(() => {
  const player = Forge.player.get();
  Forge.camera.setFov(70);
  if (player) Forge.log("PLAYER_API_OK");
});

Forge.onUpdate(() => {
  if (fired) return;
  fired = true;
  Forge.log("PLATFORM_SCRIPT_OK");
});
`);
  await page.locator("#script-save").click();
  await page.locator("#script-close").click();
  await page.locator("#play").click();

  await expect.poll(async () => page.locator("#status").textContent()).toContain("PLATFORM_SCRIPT_OK");
  await expect(page.locator("#output-log")).toContainText("PLAYER_API_OK");
  expect(await page.locator("#viewport").getAttribute("data-runtime-error")).toBeNull();
});


test("studio v0.5 supports resize, sky, UI, typed scripts, sound and lights", async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-launch-tab='develop']").click();
  await page.locator("#new-place").click();
  await page.locator("#new-place-name").fill("Studio v05 Place");
  await page.locator("#confirm-create-place").click();

  const canvas = page.locator("#viewport");
  await expect(canvas).toHaveAttribute("data-skybox", "#7fb9e8");
  await expect(page.locator("#tool-select")).toBeVisible();
  await expect(page.locator("#tool-scale")).toContainText("Resize");
  await page.locator("#tool-scale").click();
  await expect(canvas).toHaveAttribute("data-editor-tool", "scale");
  await page.locator("#tool-move").click();
  await expect(canvas).toHaveAttribute("data-editor-tool", "move");

  await page.locator("#env-sky").fill("#426f9b");
  await page.locator("#env-sky").dispatchEvent("change");
  await expect(canvas).toHaveAttribute("data-skybox", "#426f9b");

  const skyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlGQAAAAASUVORK5CYII=",
    "base64"
  );
  await page.locator("#sky-file-input").setInputFiles({
    name: "sky.png",
    mimeType: "image/png",
    buffer: skyPng
  });
  await expect(canvas).toHaveAttribute("data-sky-texture", "sky.png");
  await expect(page.locator("#sky-file-label")).toContainText("sky.png");

  await page.locator("[data-primitive='box']").click();
  await expect(page.locator("#prop-parent")).toHaveValue("");
  await page.locator("#prop-material").selectOption("metal");
  await expect(page.locator("#prop-material")).toHaveValue("metal");

  await page.locator("[data-object='empty']").click();
  await expect(page.locator("#scene-tree")).toContainText("Object");
  await expect(page.locator("#prop-parent")).toHaveValue("Block");

  await page.locator("#prop-parent").selectOption("");
  await expect(page.locator("#prop-parent")).toHaveValue("");

  await page.locator("[data-object='group']").click();
  await expect(page.locator("#scene-tree")).toContainText("Group");
  await page.locator("#prop-parent").selectOption("");

  const blockRow = page.locator(".scene-item", { hasText: "Block" }).first();
  const groupRow = page.locator(".scene-item", { hasText: "Group" }).first();
  await blockRow.dragTo(groupRow);
  await blockRow.click();
  await expect(page.locator("#prop-parent")).not.toHaveValue("");

  await page.locator(".scene-item", { hasText: "Block" }).click();
  await page.locator("#size-x").fill("6");
  await page.locator("#size-x").dispatchEvent("change");
  await expect(page.locator("#size-x")).toHaveValue("6.00");

  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlGQAAAAASUVORK5CYII=",
    "base64"
  );
  await page.locator("#texture-file-input").setInputFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: png
  });
  await expect(page.locator("#prop-texture")).toHaveValue(/^data:image\/png;base64,/);

  await page.locator("[data-object='ui-button']").click();
  await expect(page.locator("#scene-tree")).toContainText("UI Button");
  await expect(page.locator("#forge-ui-root .forge-ui-button")).toBeVisible();

  await page.locator("[data-object='localscript']").click();
  await expect(page.locator("#scene-tree")).toContainText("LocalScript");
  await page.locator("#code-selected").click();
  await expect(page.locator("#script-kind")).toHaveValue("LocalScript");
  await page.locator("#script-source").fill(`
Forge.onClick(() => {
  Forge.log("UI_CLICK_OK");
});
`);
  await page.locator("#script-save").click();
  await page.locator("#script-close").click();

  await page.locator(".scene-item", { hasText: "Baseplate" }).click();
  await page.locator("[data-object='spawn']").click();
  await expect(page.locator("#scene-tree")).toContainText("Spawn Location");

  await page.locator(".scene-item", { hasText: "Baseplate" }).click();
  await page.locator("[data-object='light']").click();
  await expect(page.locator("#scene-tree")).toContainText("Point Light");

  await page.locator(".scene-item", { hasText: "Baseplate" }).click();
  await page.locator("[data-object='sound']").click();
  await expect(page.locator("#scene-tree")).toContainText("Sound");

  await page.locator("#play").click();
  await expect(page.locator("#mode-badge")).toHaveText("PLAY");

  const uiButton = page.locator("#forge-ui-root .forge-ui-button");
  await expect(uiButton).toBeVisible();
  await expect(uiButton).toBeEnabled();
  await uiButton.click();
  await expect.poll(async () => page.locator("#status").textContent()).toContain("UI_CLICK_OK");

  expect(await canvas.getAttribute("data-runtime-error")).toBeNull();
});


test("ModuleScript libraries can be required by gameplay scripts", async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-launch-tab='develop']").click();
  await page.locator("#new-place").click();
  await page.locator("#new-place-name").fill("Module Script Place");
  await page.locator("#confirm-create-place").click();

  await page.locator(".scene-item", { hasText: "Baseplate" }).click();
  await page.locator("[data-object='modulescript']").click();
  await page.locator("#code-selected").click();
  await expect(page.locator("#script-kind")).toHaveValue("ModuleScript");
  await page.locator("#script-name").fill("math.utils");
  await page.locator("#script-source").fill(`
Forge.module({
  answer: 42,
  double(value) {
    return value * 2;
  }
});
`);
  await page.locator("#script-check").click();
  await expect(page.locator("#status")).toContainText("syntax OK");
  await page.locator("#script-save").click();
  await page.locator("#script-close").click();

  await page.locator(".scene-item", { hasText: "Baseplate" }).click();
  await page.locator("[data-object='script']").click();
  await page.locator("#code-selected").click();
  await page.locator("#script-name").fill("module.consumer");
  await page.locator("#script-source").fill(`
const math = Forge.require("math.utils");

Forge.onStart(() => {
  Forge.log("MODULE_OK:" + math.double(math.answer));
});
`);
  await page.locator("#script-check").click();
  await expect(page.locator("#status")).toContainText("syntax OK");
  await page.locator("#script-save").click();
  await page.locator("#script-close").click();

  await page.locator("#play").click();
  await expect(page.locator("#output-log")).toContainText("MODULE_OK:84");
  expect(await page.locator("#viewport").getAttribute("data-runtime-error")).toBeNull();
});


test("Studio imports real GLB and audio assets", async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-launch-tab='develop']").click();
  await page.locator("#new-place").click();
  await page.locator("#new-place-name").fill("Asset Import Place");
  await page.locator("#confirm-create-place").click();

  await expect(page.locator("#scene-tree")).toContainText("Baseplate");

  await page.locator("#model-file-input").setInputFiles({
    name: "triangle.glb",
    mimeType: "model/gltf-binary",
    buffer: makeTriangleGlb()
  });

  await expect(page.locator("#scene-tree")).toContainText("triangle");
  await expect.poll(async () => page.locator("#output-log").textContent()).toContain("Loaded model triangle");

  await page.locator("#audio-file-input").setInputFiles({
    name: "silence.wav",
    mimeType: "audio/wav",
    buffer: makeSilentWav()
  });

  await expect(page.locator("#scene-tree")).toContainText("silence");
  await expect(page.locator("#component-list")).toContainText("Sound");
  expect(await page.locator("#viewport").getAttribute("data-runtime-error")).toBeNull();
});
