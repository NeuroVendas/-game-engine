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


function makeAnimatedTriangleGlb(): Buffer {
  const binary = Buffer.alloc(76);

  const positions = [
    0, 0, 0,
    1, 0, 0,
    0, 1, 0
  ];
  positions.forEach((value, index) => binary.writeFloatLE(value, index * 4));

  binary.writeUInt16LE(0, 36);
  binary.writeUInt16LE(1, 38);
  binary.writeUInt16LE(2, 40);

  binary.writeFloatLE(0, 44);
  binary.writeFloatLE(1, 48);

  const translations = [
    0, 0, 0,
    0, 1, 0
  ];
  translations.forEach((value, index) => binary.writeFloatLE(value, 52 + index * 4));

  const json = JSON.stringify({
    asset: { version: "2.0" },
    buffers: [{ byteLength: binary.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: 36, byteLength: 6, target: 34963 },
      { buffer: 0, byteOffset: 44, byteLength: 8 },
      { buffer: 0, byteOffset: 52, byteLength: 24 }
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
      },
      {
        bufferView: 2,
        componentType: 5126,
        count: 2,
        type: "SCALAR",
        min: [0],
        max: [1]
      },
      {
        bufferView: 3,
        componentType: 5126,
        count: 2,
        type: "VEC3",
        min: [0, 0, 0],
        max: [0, 1, 0]
      }
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    nodes: [{ mesh: 0 }],
    animations: [{
      name: "Bounce",
      samplers: [{ input: 2, output: 3, interpolation: "LINEAR" }],
      channels: [{ sampler: 0, target: { node: 0, path: "translation" } }]
    }],
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

async function readPlayerXZ(page: any): Promise<[number, number]> {
  const raw = await page.locator("#viewport").getAttribute("data-player-position");
  if (!raw) throw new Error("Player position is unavailable.");
  const [x, , z] = raw.split(",").map(Number);
  return [x, z];
}

async function holdMovement(page: any, keys: string[], milliseconds: number): Promise<void> {
  for (const key of keys) await page.keyboard.down(key);
  await page.waitForTimeout(milliseconds);
  for (const key of [...keys].reverse()) await page.keyboard.up(key);
  await page.waitForTimeout(45);
}

async function calibratePlayerAxes(page: any): Promise<{ forward: [number, number]; right: [number, number] }> {
  const waitForSettle = async () => {
    await expect.poll(async () => {
      const raw = await page.locator("#viewport").getAttribute("data-player-velocity");
      if (!raw) return 999;
      const [vx, , vz] = raw.split(",").map(Number);
      return Math.hypot(vx, vz);
    }, {
      timeout: 2200,
      intervals: [60, 80, 100]
    }).toBeLessThan(0.35);
  };

  const measureKey = async (key: string): Promise<[number, number]> => {
    const before = await readPlayerXZ(page);
    await holdMovement(page, [key], 260);
    const after = await readPlayerXZ(page);
    await waitForSettle();

    const dx = after[0] - before[0];
    const dz = after[1] - before[1];
    const length = Math.hypot(dx, dz);
    if (length < 0.05) {
      throw new Error(`Could not calibrate player movement for ${key}.`);
    }
    return [dx / length, dz / length];
  };

  // Measure both axes from real controller output instead of deriving strafe
  // mathematically from W. This remains correct if camera/movement conventions change.
  const forward = await measureKey("KeyW");
  const right = await measureKey("KeyD");
  return { forward, right };
}

async function moveUntilCoordinate(
  page: any,
  key: string,
  reached: (position: [number, number]) => boolean,
  timeout = 12000
): Promise<void> {
  await page.keyboard.down(key);
  try {
    await expect.poll(async () => reached(await readPlayerXZ(page)), {
      timeout,
      intervals: [50, 60, 70]
    }).toBe(true);
  } finally {
    await page.keyboard.up(key);
  }

  // Walking deceleration finishes quickly; allow it to settle before the next axis.
  await page.waitForTimeout(180);
}

async function expectInteractionPrompt(page: any, promptText: string): Promise<void> {
  await expect(page.locator("#interaction-prompt")).toContainText(promptText);
}

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

  await page.keyboard.down("ShiftLeft");
  await page.waitForTimeout(360);
  const sprintVelocityRaw = (await canvas.getAttribute("data-player-velocity"))!;
  const sprintVelocity = Math.hypot(
    Number(sprintVelocityRaw.split(",")[0]),
    Number(sprintVelocityRaw.split(",")[2])
  );
  expect(sprintVelocity).toBeGreaterThan(fullVelocity + 0.5);
  await expect(canvas).toHaveAttribute("data-player-movement-state", "sprint");
  await page.keyboard.up("ShiftLeft");

  const thirdPersonRadiusBefore = Number(await canvas.getAttribute("data-camera-radius"));
  expect(thirdPersonRadiusBefore).toBeGreaterThanOrEqual(2.3);

  await page.keyboard.press("KeyC");
  await expect(canvas).toHaveAttribute("data-camera-mode", "first-person");
  expect(Number(await canvas.getAttribute("data-camera-radius"))).toBeLessThan(0.7);

  await page.keyboard.press("KeyC");
  await expect(canvas).toHaveAttribute("data-camera-mode", "third-person");
  const restoredThirdPersonRadius = Number(await canvas.getAttribute("data-camera-radius"));
  expect(Math.abs(restoredThirdPersonRadius - thirdPersonRadiusBefore)).toBeLessThan(0.2);

  await page.keyboard.up("KeyW");
  await page.waitForTimeout(120);
  const after = (await canvas.getAttribute("data-player-position"))!;
  expect(after).not.toBe(before);

  await expect.poll(async () => {
    const velocityRaw = (await canvas.getAttribute("data-player-velocity"))!;
    return Math.hypot(
      Number(velocityRaw.split(",")[0]),
      Number(velocityRaw.split(",")[2])
    );
  }, {
    timeout: 1200,
    intervals: [60, 80, 100]
  }).toBeLessThan(0.5);

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
  test.setTimeout(80_000);
  await page.goto("/");
  await page.locator("[data-launch-tab='develop']").click();
  await page.locator("#new-place").click();
  await page.locator("#new-place-name").fill("Studio v05 Place");
  await page.locator("#confirm-create-place").click();

  const canvas = page.locator("#viewport");
  await expect(canvas).toHaveAttribute("data-skybox", "#7fb9e8");
  await expect(page.locator("#tool-select")).toBeVisible();
  await expect(page.locator("#tool-scale")).toContainText("Resize");
  await expect(canvas).toHaveAttribute("data-editor-space", "world");
  await page.locator("#transform-space").click();
  await expect(canvas).toHaveAttribute("data-editor-space", "local");
  await expect(page.locator("#transform-space")).toHaveText("Local");
  await page.locator("#transform-space").click();
  await expect(canvas).toHaveAttribute("data-editor-space", "world");

  await page.locator("#rotation-snap").selectOption("45");
  await expect(page.locator("#rotation-snap")).toHaveValue("45");
  await page.locator("#scale-snap").selectOption("0.25");
  await expect(page.locator("#scale-snap")).toHaveValue("0.25");

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

  await page.locator("#env-fog-density").fill("0.012");
  await page.locator("#env-fog-density").dispatchEvent("change");
  await expect(canvas).toHaveAttribute("data-sky-texture", "sky.png");

  await page.locator("[data-environment-preset='night']").click();
  await expect(canvas).toHaveAttribute("data-environment-preset", "night");
  await expect(canvas).toHaveAttribute("data-skybox", "#17263f");
  await expect(canvas).not.toHaveAttribute("data-sky-texture", /.+/);
  await expect(page.locator("#env-fog-density")).toHaveValue("0.006");
  await expect(page.locator("#sky-file-label")).toContainText("Color sky");

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

  await page.locator(".scene-item", { hasText: "Baseplate" }).click();
  await page.locator("[data-object='vfx']").click();
  await expect(page.locator("#scene-tree")).toContainText("Particle VFX");
  await expect(page.locator("#component-list")).toContainText("Particle");
  await expect(canvas).toHaveAttribute("data-particle-systems", "1");
  await expect(canvas).toHaveAttribute("data-particle-presets", "energy");

  await page.locator("#play").click();
  await expect(page.locator("#mode-badge")).toHaveText("PLAY");

  const uiButton = page.locator("#forge-ui-root .forge-ui-button");
  await expect(uiButton).toBeVisible();
  await expect(uiButton).toBeEnabled();
  await uiButton.evaluate((button) => (button as HTMLButtonElement).click());
  await expect.poll(async () => page.locator("#status").textContent()).toContain("UI_CLICK_OK");
  const outputText = await page.locator("#output-log").textContent();
  expect((outputText?.match(/UI_CLICK_OK/g) ?? []).length).toBe(1);

  expect(await canvas.getAttribute("data-runtime-error")).toBeNull();
});


test("Studio visualizes colliders and round-trips custom prefab hierarchies", async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-launch-tab='develop']").click();
  await page.locator("#new-place").click();
  await page.locator("#new-place-name").fill("Prefab Physics Place");
  await page.locator("#confirm-create-place").click();

  const canvas = page.locator("#viewport");

  await page.locator("[data-object='group']").click();
  await page.locator("#prop-name").fill("Custom Assembly");
  await page.locator("#prop-name").dispatchEvent("change");
  await page.locator("#prop-parent").selectOption("");
  const groupId = await page.locator(".scene-item.selected").getAttribute("data-entity-id");
  expect(groupId).toBeTruthy();

  await page.locator("[data-primitive='box']").click();
  await page.locator("#prop-name").fill("Prefab Block");
  await page.locator("#prop-name").dispatchEvent("change");
  await page.locator(".scene-item", { hasText: "Prefab Block" }).dragTo(
    page.locator(".scene-item", { hasText: "Custom Assembly" }).first()
  );

  await page.locator(".scene-item", { hasText: "Prefab Block" }).first().click();
  await page.getByLabel("Collision mode").selectOption("box");
  await page.getByLabel("Collider size X").fill("3.5");
  await page.getByLabel("Collider size X").dispatchEvent("change");
  await page.getByLabel("Collider size Y").fill("2.5");
  await page.getByLabel("Collider size Y").dispatchEvent("change");
  await page.getByLabel("Collider size Z").fill("1.25");
  await page.getByLabel("Collider size Z").dispatchEvent("change");
  await page.getByLabel("Collider offset X").fill("0.4");
  await page.getByLabel("Collider offset X").dispatchEvent("change");

  await expect(canvas).toHaveAttribute("data-collider-proxy-count", "1");

  await page.locator("[data-primitive='sphere']").click();
  await page.locator("#prop-name").fill("Prefab Sphere");
  await page.locator("#prop-name").dispatchEvent("change");
  await page.locator(".scene-item", { hasText: "Prefab Sphere" }).dragTo(
    page.locator(".scene-item", { hasText: "Custom Assembly" }).first()
  );

  await page.locator(".scene-item", { hasText: "Custom Assembly" }).first().click();

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export-prefab").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("custom-assembly.forge-prefab.json");

  const stream = await download.createReadStream();
  if (!stream) throw new Error("Prefab download stream unavailable.");
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const prefabBytes = Buffer.concat(chunks);
  const exported = JSON.parse(prefabBytes.toString("utf8"));

  expect(exported.format).toBe("forge.prefab");
  expect(exported.version).toBe(1);
  expect(exported.name).toBe("Custom Assembly");
  expect(exported.entities).toHaveLength(3);

  const exportedBlock = exported.entities.find((entity: any) => entity.name === "Prefab Block");
  expect(exportedBlock?.components?.Collider).toMatchObject({
    enabled: true,
    mode: "box",
    size: [3.5, 2.5, 1.25],
    offset: [0.4, 0, 0]
  });

  const exportedRoot = exported.entities.find((entity: any) => !entity.parentId);
  expect(exportedRoot).toBeTruthy();
  expect(exportedRoot.position).toEqual([0, 0, 0]);
  expect(
    exported.entities
      .filter((entity: any) => entity.id !== exportedRoot.id)
      .every((entity: any) => entity.parentId === exportedRoot.id)
  ).toBe(true);

  await page.locator("#prefab-file-input").setInputFiles({
    name: "custom-assembly.forge-prefab.json",
    mimeType: "application/json",
    buffer: prefabBytes
  });

  await expect(page.locator(".scene-item", { hasText: "Custom Assembly" })).toHaveCount(2);
  await expect(page.locator(".scene-item", { hasText: "Prefab Block" })).toHaveCount(2);
  await expect(page.locator(".scene-item", { hasText: "Prefab Sphere" })).toHaveCount(2);
  await expect(canvas).toHaveAttribute("data-collider-proxy-count", "2");

  const importedId = await page.locator(".scene-item.selected").getAttribute("data-entity-id");
  expect(importedId).toBeTruthy();
  expect(importedId).not.toBe(groupId);
  await expect(page.locator("#prop-parent")).toHaveValue(groupId!);

  await page.locator("#player-collider-height").fill("2.4");
  await page.locator("#player-collider-height").dispatchEvent("change");
  await page.locator("#player-collider-radius").fill("0.35");
  await page.locator("#player-collider-radius").dispatchEvent("change");
  await page.locator("#player-walk-speed").fill("4.2");
  await page.locator("#player-walk-speed").dispatchEvent("change");
  await page.locator("#player-run-speed").fill("6.8");
  await page.locator("#player-run-speed").dispatchEvent("change");
  await page.locator("#player-jump-power").fill("6.5");
  await page.locator("#player-jump-power").dispatchEvent("change");
  await expect(canvas).toHaveAttribute("data-scene-player-collider", "2.400,0.350");
  await expect(canvas).toHaveAttribute("data-scene-player-movement", "4.200,6.800,6.500");

  await page.locator("#collision-debug").click();
  await expect(canvas).toHaveAttribute("data-collision-debug", "true");
  await expect.poll(async () => Number(await canvas.getAttribute("data-collision-debug-count")))
    .toBeGreaterThanOrEqual(5);
  await expect(page.locator("#collision-debug")).toHaveText("Colliders On");

  await page.locator("#play").click();
  await expect(page.locator("#mode-badge")).toHaveText("PLAY");
  await expect(canvas).toHaveAttribute("data-collision-debug", "false");
  await expect(canvas).toHaveAttribute("data-player-collider-height", "2.400");
  await expect(canvas).toHaveAttribute("data-player-collider-radius", "0.350");
  await expect(canvas).toHaveAttribute("data-player-walk-speed", "4.200");
  await expect(canvas).toHaveAttribute("data-player-run-speed", "6.800");
  await expect(canvas).toHaveAttribute("data-player-jump-power", "6.500");

  await page.locator("#stop").click();
  await expect(page.locator("#mode-badge")).toHaveText("EDITOR");
  await expect(canvas).toHaveAttribute("data-collision-debug", "true");
  await expect(page.locator("#collision-debug")).toHaveText("Colliders On");
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


test("Studio imports GLB animations and audio assets", async ({ page }) => {
  test.setTimeout(110_000);
  await page.goto("/");
  await page.locator("[data-launch-tab='develop']").click();
  await page.locator("#new-place").click();
  await page.locator("#new-place-name").fill("Asset Import Place");
  await page.locator("#confirm-create-place").click();

  const canvas = page.locator("#viewport");
  await expect(page.locator("#scene-tree")).toContainText("Baseplate");

  await page.locator("#model-file-input").setInputFiles({
    name: "animated-triangle.glb",
    mimeType: "model/gltf-binary",
    buffer: makeAnimatedTriangleGlb()
  });

  await expect(page.locator("#scene-tree")).toContainText("animated-triangle");
  await expect.poll(async () => page.locator("#output-log").textContent())
    .toContain("Loaded model animated-triangle");
  await expect.poll(async () => canvas.getAttribute("data-model-animation-groups"))
    .toBe("1");
  await expect(page.locator("#component-list")).toContainText("Clips: Bounce");

  await page.locator("#component-type").selectOption("Collider");
  await page.locator("#add-component").click();
  await page.getByLabel("Collision mode").selectOption("box");
  await expect(canvas).toHaveAttribute("data-collider-proxy-count", "1");
  await expect.poll(async () => canvas.getAttribute("data-model-animation-groups"), {
    timeout: 10000
  }).toBe("1");

  await page.locator("[data-collider-auto-fit]").click();
  await expect(canvas).toHaveAttribute("data-last-collider-fit", /animated-triangle/);
  await expect(page.getByLabel("Collider size X")).toHaveValue("1");
  await expect(page.getByLabel("Collider size Y")).toHaveValue("1");
  await expect(page.getByLabel("Collider size Z")).toHaveValue("0.05");
  await expect(page.getByLabel("Collider offset X")).toHaveValue("0.5");
  await expect(page.getByLabel("Collider offset Y")).toHaveValue("0.5");

  await page.locator("[data-collider-reset]").click();
  await expect(canvas).toHaveAttribute("data-last-collider-reset", /animated-triangle/);
  await expect(page.getByLabel("Collider size X")).toHaveValue("1");
  await expect(page.getByLabel("Collider size Y")).toHaveValue("1");
  await expect(page.getByLabel("Collider size Z")).toHaveValue("1");
  await expect(page.getByLabel("Collider offset X")).toHaveValue("0");
  await expect(page.getByLabel("Collider offset Y")).toHaveValue("0");

  await page.locator("[data-collider-auto-fit]").click();
  await expect(page.getByLabel("Collider size Z")).toHaveValue("0.05");
  await expect(page.getByLabel("Collider offset X")).toHaveValue("0.5");
  await expect(page.getByLabel("Collider offset Y")).toHaveValue("0.5");
  await expect(page.locator("#component-list")).toContainText("Clips: Bounce");

  const clip = page.locator("[data-model-animation-clip]");
  await expect(clip.locator("option")).toContainText(["First clip (Bounce)", "Bounce"]);
  await clip.selectOption("Bounce");

  await page.locator("[data-model-animation-autoplay]").evaluate((input) => {
    const checkbox = input as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator("[data-model-animation-autoplay]")).toBeChecked();
  await page.locator("[data-model-animation-speed]").fill("1.5");
  await page.locator("[data-model-animation-speed]").dispatchEvent("change");

  await page.locator("[data-model-animation-preview]").evaluate((button) => {
    (button as HTMLButtonElement).click();
  });
  await expect(page.locator("#output-log")).toContainText("Previewing animation on animated-triangle");
  await expect(canvas).toHaveAttribute("data-last-animation-action", /play:.*:Bounce/);

  await page.locator("[data-model-animation-stop]").evaluate((button) => {
    (button as HTMLButtonElement).click();
  });
  await expect(canvas).toHaveAttribute("data-last-animation-action", /stop:.*:\*/);

  await page.locator("#play").click();
  await expect(page.locator("#mode-badge")).toHaveText("PLAY");
  await expect.poll(async () => canvas.getAttribute("data-last-animation-action"))
    .toMatch(/play:.*:Bounce/);

  await page.locator("#stop").click();
  await expect(page.locator("#mode-badge")).toHaveText("EDITOR");
  await expect.poll(async () => canvas.getAttribute("data-model-animation-groups"))
    .toBe("1");

  // Runtime scripts start synchronously while GLB loading is asynchronous.
  // Verify Forge.animation.play queues the request instead of losing it.
  await page.locator(".scene-item", { hasText: "animated-triangle" }).click();
  await page.locator("[data-model-animation-autoplay]").evaluate((input) => {
    const checkbox = input as HTMLInputElement;
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator("[data-model-animation-autoplay]")).not.toBeChecked();

  await page.locator("[data-object='script']").click();
  await expect(page.locator("#scene-tree")).toContainText("Script");
  await page.locator("#code-selected").click();
  await page.locator("#script-source").fill(`
Forge.onStart(() => {
  const queued = Forge.animation.play("animated-triangle", "Bounce");
  Forge.log("ANIMATION_SCRIPT_OK:" + queued);
});
`);
  await page.locator("#script-save").click();
  await page.locator("#script-close").click();

  await page.locator("#play").click();
  await expect(page.locator("#mode-badge")).toHaveText("PLAY");
  await expect(page.locator("#output-log")).toContainText("ANIMATION_SCRIPT_OK:true");
  await expect.poll(async () => canvas.getAttribute("data-last-animation-action"), {
    timeout: 10000
  }).toMatch(/play:.*:Bounce/);

  await page.locator("#stop").click();
  await expect(page.locator("#mode-badge")).toHaveText("EDITOR");

  await page.locator(".scene-item", { hasText: "Baseplate" }).click();
  await page.locator("#audio-file-input").setInputFiles({
    name: "silence.wav",
    mimeType: "audio/wav",
    buffer: makeSilentWav()
  });

  await expect(page.locator("#scene-tree")).toContainText("silence");
  await expect(page.locator("#component-list")).toContainText("Sound");
  expect(await canvas.getAttribute("data-runtime-error")).toBeNull();
});


test("Core Relay template is a playable complete-game benchmark", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.locator("[data-launch-tab='develop']").click();
  await page.locator("[data-develop-view='templates']").click();

  const coreRelay = page.locator("[data-template-scene='core-relay']");
  await expect(coreRelay).toBeVisible();
  await coreRelay.click();

  await expect(page.locator("#app")).toBeVisible();
  await expect(page.locator("#studio-project-name")).toContainText("Core Relay");
  await expect(page.locator("#scene-tree")).toContainText("Game Controller");
  await expect(page.locator("#scene-tree")).toContainText("Relay A");
  await expect(page.locator("#scene-tree")).toContainText("Hint Button");
  await expect(page.locator("#scene-tree")).toContainText("Core Victory VFX");
  await expect(page.locator("#viewport")).toHaveAttribute("data-particle-systems", "1");

  await page.locator("#play").click();
  await expect(page.locator("#mode-badge")).toHaveText("PLAY");
  await expect(page.locator("#forge-ui-root")).toContainText("Activate the 3 relay consoles");
  await expect(page.locator("#forge-ui-root")).toContainText("Need a hint?");
  await expect(page.locator("#output-log")).toContainText("CORE_RELAY_READY");

  const hint = page.locator("#forge-ui-root .forge-ui-button");
  await hint.evaluate((button) => (button as HTMLButtonElement).click());
  await expect(page.locator("#forge-ui-root")).toContainText("Walk to each metal relay and press E");

  const canvas = page.locator("#viewport");
  const axes = await calibratePlayerAxes(page);
  expect(Math.abs(axes.forward[1])).toBeGreaterThan(0.75);
  expect(Math.abs(axes.right[0])).toBeGreaterThan(0.75);

  const xPositive = axes.right[0] >= 0 ? "KeyD" : "KeyA";
  const xNegative = xPositive === "KeyD" ? "KeyA" : "KeyD";
  const zNegative = axes.forward[1] >= 0 ? "KeyS" : "KeyW";

  // Use axis-aligned gates through known open lanes. This keeps the acceptance
  // path on real WASD input while avoiding controller inertia around diagonal waypoints.
  await moveUntilCoordinate(page, xNegative, ([x]) => x <= -6.6);
  await moveUntilCoordinate(page, zNegative, ([, z]) => z <= -3.1);
  await expectInteractionPrompt(page, "Relay A");
  await page.keyboard.press("KeyE");
  await expect(page.locator("#forge-ui-root")).toContainText("1 / 3 relays online");

  // Relay B: step away from A, descend the open lower lane, then approach from the west.
  await moveUntilCoordinate(page, xPositive, ([x]) => x >= -3.8);
  await moveUntilCoordinate(page, zNegative, ([, z]) => z <= -7.2);
  await moveUntilCoordinate(page, xPositive, ([x]) => x >= -1.2);
  await expectInteractionPrompt(page, "Relay B");
  await page.keyboard.press("KeyE");
  await expect(page.locator("#forge-ui-root")).toContainText("2 / 3 relays online");

  // Relay C: stay in the lower lane and approach from the west, before its collider face.
  await moveUntilCoordinate(page, xPositive, ([x]) => x >= 4.4);
  await expectInteractionPrompt(page, "Relay C");
  await page.keyboard.press("KeyE");
  await expect(page.locator("#forge-ui-root")).toContainText("3 / 3 relays online");
  await expect(page.locator("#forge-ui-root")).toContainText("CORE ONLINE • YOU WIN");
  await expect(page.locator("#output-log")).toContainText("CORE_RELAY_WIN");
  await expect(canvas).toHaveAttribute("data-last-vfx-action", "restart:CoreVictoryVFX");
  expect(await canvas.getAttribute("data-runtime-error")).toBeNull();

  // Real audio and particle resources must survive repeated Editor <-> Play transitions.
  await page.locator("#stop").click();
  await expect(page.locator("#mode-badge")).toHaveText("EDITOR");
  await page.locator("#play").click();
  await expect(page.locator("#mode-badge")).toHaveText("PLAY");
  await expect(page.locator("#output-log")).toContainText("CORE_RELAY_READY");
  expect(await page.locator("#viewport").getAttribute("data-runtime-error")).toBeNull();
});
