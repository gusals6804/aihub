import { test, expect } from "@playwright/test";
test("모바일 홈·갤러리·로그인 없는 공유 실행·가로 넘침 없음", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator(".hero h1")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/home-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "메뉴", exact: true }).click();
  await page.getByRole("link", { name: "갤러리", exact: true }).click();
  await expect(page.getByRole("heading", { name: "에이전트 갤러리" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const r = await request.post("/api/content", {
    data: {
      kind: "agent",
      title: "모바일 공유 검증",
      description: "모바일에서 실제 실행",
      category: "work",
      visibility: "link",
      definition: { type: "structured", variables: "제목,내용" },
    },
  });
  const { content } = await r.json();
  const s = await request.post(`/api/content/${content.id}/share`, { data: {} });
  const { path } = await s.json();
  await page.goto(path);
  await page.getByRole("textbox", { name: "분석할 내용" }).fill("모바일 실행\n완료");
  await page.getByRole("button", { name: "실행하기", exact: true }).click();
  await expect(page.getByRole("cell", { name: "모바일 실행" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/share-mobile.png", fullPage: true });
});
