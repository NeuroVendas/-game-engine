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
  await heliosCard.locator("[data-action='favorite']").click();
  await expect(page.locator("#favorite-count")).toHaveText("1");

  await heliosCard.locator("[data-action='play']").click();
  await expect(page.locator("#app")).toBeVisible();
  await expect(page.locator("#app")).toHaveClass(/game-session/);
  await expect(page.locator("#mode-badge")).toHaveText("PLAY");

  const canvas = page.locator("#viewport");
  await expect.poll(async () => canvas.getAttribute("data-player-position")).not.toBeNull();
  const before = (await canvas.getAttribute("data-player-position"))!;

  await page.keyboard.down("KeyW");
  await page.waitForTimeout(500);
  await page.keyboard.up("KeyW");
  const after = (await canvas.getAttribute("data-player-position"))!;
  expect(after).not.toBe(before);

  await page.locator("#exit-game").click();
  await expect(page.locator("#launcher-page-games")).toBeVisible();
  await expect(page.locator("#app")).toBeHidden();

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

  const card = page.locator("#game-grid .place-card[data-place-name='Menu Test Place']");
  await expect(card).toHaveCount(1);

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
  expect(await page.locator("#viewport").getAttribute("data-runtime-error")).toBeNull();
});
