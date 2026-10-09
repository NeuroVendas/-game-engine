import { test, expect } from "@playwright/test";

test("signup and resend confirmation point back to the active Forge website", async ({ page }) => {
  let signupRedirect = "";
  let resendRedirect = "";
  await page.route("**/auth/v1/signup**", async (route) => {
    signupRedirect = new URL(route.request().url()).searchParams.get("redirect_to") ?? "";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "11111111-1111-4111-8111-111111111111",
          aud: "authenticated",
          email: "auth-smoke@example.test",
          app_metadata: { provider: "email", providers: ["email"] },
          user_metadata: {},
          created_at: "2026-10-09T12:00:00Z"
        },
        session: null
      })
    });
  });
  await page.route("**/auth/v1/resend**", async (route) => {
    resendRedirect = new URL(route.request().url()).searchParams.get("redirect_to") ?? "";
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.goto("/");
  await page.locator("#account-button").click();
  await page.locator("#auth-email").fill("auth-smoke@example.test");
  await page.locator("#auth-password").fill("strong-non-real-pass-2026");
  await page.locator("#auth-display-name").fill("Auth QA");
  await page.locator("#auth-sign-up").click();
  await expect(page.locator("#auth-message")).toContainText("Check your email");

  const current = new URL(page.url());
  const expectedCallback = new URL(current.pathname, current.origin).href;
  expect(signupRedirect).toBe(expectedCallback);
  expect(signupRedirect).not.toContain("localhost:3000");

  await page.locator("#auth-resend").click();
  await expect(page.locator("#auth-message")).toContainText("newest link");
  expect(resendRedirect).toBe(expectedCallback);
});

test("expired confirmation shows actionable message without taking Forge Cloud offline", async ({ page }) => {
  await page.goto("/#error=access_denied&error_code=otp_expired");
  await expect(page.locator("#auth-dialog")).toBeVisible();
  await expect(page.locator("#auth-message")).toContainText("already used");
  await expect(page.locator("#auth-message")).toContainText("Resend confirmation");
  await expect(page.locator("#cloud-status")).toContainText("Forge Cloud Online");
});
