import { test, expect } from "@playwright/test";

test("Echo Vault is a playable, remixable first-party game visible without an account", async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-launch-tab='games']").click();

  const card = page.locator('.game-card[data-place-name="ECHO VAULT • Power Shift"]');
  await expect(card).toBeVisible();
  await expect(card).toContainText("ECHO VAULT");
  await card.locator('[data-action="play"]').click();

  const canvas = page.locator("#viewport");
  await expect(page.locator("#mode-badge")).toHaveText("PLAY");
  await expect(page.locator("#game-session-title")).toHaveText("ECHO VAULT • Power Shift");
  await expect(page.locator("#output-log")).toContainText("ECHO_VAULT_READY");
  await expect(page.locator("#forge-ui-root")).toContainText("0 / 3 POWER NODES");

  await expect(canvas).toHaveAttribute("data-player-dead", "false");
  await expect(canvas).not.toHaveAttribute("data-runtime-error", /./);

  await page.locator("#game-session-home").click();
  await expect(page.locator("#launcher")).toBeVisible();

  await page.locator("[data-launch-tab='develop']").click();
  const official = page.locator('.game-card[data-place-name="ECHO VAULT • Power Shift"]');
  await expect(official).toBeVisible();
  await official.locator('[data-action="remix"]').click();
  await expect(page.locator("#mode-badge")).toHaveText("EDITOR");
  await expect(page.locator("#studio-project-name")).toContainText("ECHO VAULT");
  await expect(page.locator("#scene-tree")).toContainText("Power Node A");
  await expect(page.locator("#scene-tree")).toContainText("Checkpoint");
});

test("Code button opens a real script editor in a blank project", async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-launch-tab='develop']").click();
  await page.locator("#new-place").click();
  await page.locator("#new-place-name").fill("Code UX Smoke");
  await page.locator("#confirm-create-place").click();

  await page.locator("#code-selected").click();
  await expect(page.locator("#script-editor-dialog")).toBeVisible();
  await expect(page.locator("#script-kind")).toHaveValue("Script");
  await expect(page.locator("#script-source")).toHaveValue(/Forge.onStart/);

  await page.locator("#script-source").fill('Forge.onStart(() => Forge.log("CODE_EDITOR_WORKS"));');
  await page.locator("#script-save").click();
  await page.locator("#script-close").click();
  await expect(page.locator("#scene-tree")).toContainText("Script");

  await page.locator("#code-selected").click();
  await expect(page.locator("#script-editor-dialog")).toBeVisible();
  await expect(page.locator("#script-source")).toHaveValue(/CODE_EDITOR_WORKS/);
  await page.locator("#script-close").click();

  await page.locator("#play").click();
  await expect(page.locator("#output-log")).toContainText("CODE_EDITOR_WORKS");
  await expect(page.locator("#mode-badge")).toHaveText("PLAY");
});

test("Studio toolbar wraps without horizontal scrolling or clipped controls", async ({ page }) => {
  await page.setViewportSize({ width: 1190, height: 820 });
  await page.goto("/");
  await page.locator("[data-launch-tab='develop']").click();
  await page.locator("#new-place").click();
  await page.locator("#new-place-name").fill("Responsive Toolbar Smoke");
  await page.locator("#confirm-create-place").click();
  await expect(page.locator("#mode-badge")).toHaveText("EDITOR");

  const measured = await page.locator("#app").evaluate((app) => {
    const topbar = app.querySelector(".topbar") as HTMLElement;
    const toolbar = app.querySelector(".toolbar") as HTMLElement;
    const play = app.querySelector("#play") as HTMLElement;
    const rect = topbar.getBoundingClientRect();
    const playRect = play.getBoundingClientRect();
    return {
      documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
      toolbarOverflow: toolbar.scrollWidth - toolbar.clientWidth,
      headerHeight: rect.height,
      playInside: playRect.left >= rect.left && playRect.right <= rect.right,
      viewportHeight: window.innerHeight
    };
  });
  expect(measured.documentOverflow).toBeLessThanOrEqual(2);
  expect(measured.toolbarOverflow).toBeLessThanOrEqual(2);
  expect(measured.headerHeight).toBeGreaterThan(32);
  expect(measured.playInside).toBe(true);
});
