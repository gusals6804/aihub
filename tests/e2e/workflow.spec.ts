import { test, expect, type APIRequestContext } from "@playwright/test";
const definition = { type: "structured", variables: "주제,핵심 내용,다음 행동" };
async function create(request: APIRequestContext, extra: Record<string, unknown> = {}) {
  const r = await request.post("/api/content", {
    data: {
      kind: "agent",
      title: "브라우저 검증 도구",
      description: "실제 입력을 정리합니다.",
      category: "work",
      visibility: "link",
      definition,
      ...extra,
    },
  });
  expect(r.status()).toBe(201);
  return r.json();
}
async function share(request: APIRequestContext, id: string) {
  const r = await request.post(`/api/content/${id}/share`, { data: {} });
  expect(r.ok()).toBeTruthy();
  return (await r.json()).path as string;
}

test("01 새 브라우저의 홈·갤러리·7개 기본 에이전트", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "오늘도, Agent Hub와 함께." })).toBeVisible();
  await expect(page.getByRole("link", { name: "로그인", exact: true })).toHaveCount(0);
  await expect(page.locator(".agent-card")).toHaveCount(7);
  await page.screenshot({ path: "artifacts/home-desktop.png", fullPage: true });
  await page.getByRole("link", { name: "갤러리", exact: true }).click();
  await expect(page.getByRole("heading", { name: "에이전트 갤러리" })).toBeVisible();
  await expect(page.locator(".agent-card")).toHaveCount(7);
  await page.getByRole("textbox", { name: "갤러리 검색" }).fill("웨딩");
  await expect(page.locator(".agent-card")).toHaveCount(1);
  await page.getByRole("button", { name: "검색 지우기" }).click();
  await page.screenshot({ path: "artifacts/gallery-desktop.png", fullPage: true });
});
test("02 ETF 실제 CSV 업로드·계산·차트·결과 다운로드", async ({ page }) => {
  await page.goto("/agents/etf");
  await page.locator("input[type=file]").setInputFiles({
    name: "real.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("name,return,fee,date\nAAA,10,0.1,2026-01-01\nBBB,20,0.2,2026-01-01"),
  });
  await page.getByRole("button", { name: "실행하기", exact: true }).click();
  await expect(page.getByText("2개 행, 4개 항목을 분석했습니다.")).toBeVisible();
  await expect(page.getByText("return: 평균 15.0000", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "차트·지도" }).click();
  await expect(page.locator(".bars")).toBeVisible();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV 다운로드" }).click();
  expect((await dl).suggestedFilename()).toBe("agent-result.csv");
  await page.screenshot({ path: "artifacts/run-desktop.png", fullPage: true });
});
test("03 제작 → 저장 → 공유 → 시크릿 실행 → 무단 수정 차단 → 복제", async ({ page, browser }) => {
  await page.goto("/make");
  await page.getByRole("textbox", { name: "이름", exact: false }).first().fill("내 업무 정리");
  await page.getByRole("textbox", { name: "한 줄 소개" }).fill("직접 만든 익명 에이전트");
  await page.getByRole("button", { name: "다음 단계" }).click();
  await page.getByRole("button", { name: "저장 전 실제 테스트 실행" }).click();
  await expect(page.getByText("입력을 구조화했습니다.")).toBeVisible();
  await page.getByRole("button", { name: "저장하기", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const recovery = await page.getByRole("textbox", { name: "복구 키", exact: true }).inputValue();
  expect(recovery).toHaveLength(43);
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(page.getByRole("heading", { name: "내 업무 정리", exact: true })).toBeVisible();
  const id = page.url().split("/").at(-1)!;
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name.startsWith("hub_edit_"))?.httpOnly).toBe(true);
  expect(cookies.find((c) => c.name === "hub_browser")?.sameSite).toBe("Lax");
  await page.getByRole("button", { name: "공유하기", exact: true }).click();
  const link = await page.getByRole("textbox", { name: "공유 링크", exact: true }).inputValue();
  expect(link).not.toContain(recovery);
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  const incognito = await browser.newContext({ baseURL: "http://127.0.0.1:3100" });
  const guest = await incognito.newPage();
  await guest.goto(link);
  await expect(guest.getByRole("heading", { name: "내 업무 정리", exact: true })).toBeVisible();
  await guest
    .getByRole("textbox", { name: "도움이 필요한 내용" })
    .fill("동료의 주제\n확인된 내용\n다음 행동");
  await guest.getByRole("button", { name: "실행하기", exact: true }).click();
  await expect(guest.getByRole("cell", { name: "동료의 주제" })).toBeVisible();
  const denied = await incognito.request.patch(`/api/content/${id}`, { data: { title: "도용" } });
  expect(denied.status()).toBe(403);
  expect((await incognito.request.delete(`/api/content/${id}`)).status()).toBe(403);
  await guest.getByRole("button", { name: "복제해서 만들기" }).click();
  await expect(guest.getByRole("dialog")).toBeVisible();
  await guest.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(
    guest.getByRole("heading", { name: "내 업무 정리 (복제)", exact: true }),
  ).toBeVisible();
  expect(guest.url()).not.toContain(id);
  await guest.getByRole("textbox", { name: "도움이 필요한 내용" }).fill("독립 복제\n새 입력\n실행");
  await guest.getByRole("button", { name: "실행하기", exact: true }).click();
  await expect(guest.getByRole("cell", { name: "독립 복제" })).toBeVisible();
  await incognito.close();
});
test("04 HTML 업로드·다른 브라우저 열기·샌드박스·CSP", async ({ page, browser }) => {
  await page.goto("/make?kind=html");
  await page.getByRole("textbox", { name: "이름", exact: false }).first().fill("격리 HTML");
  await page.locator("input[type=file]").setInputFiles({
    name: "tool.html",
    mimeType: "text/html",
    buffer: Buffer.from(
      '<!doctype html><html><body><h1>격리 도구</h1><script>try {parent.document.body.dataset.hacked="yes"} catch(e){document.body.dataset.blocked="yes"}</script><script>fetch("https://example.com/leak")</script></body></html>',
    ),
  });
  await page.getByRole("button", { name: "다음 단계" }).click();
  await page.getByRole("button", { name: "저장하기", exact: true }).click();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(
    page.frameLocator("iframe").getByRole("heading", { name: "격리 도구" }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toHaveAttribute("data-hacked");
  const id = page.url().split("/").at(-1)!;
  const link = await share(page.request, id);
  const ctx = await browser.newContext({ baseURL: "http://127.0.0.1:3100" });
  const guest = await ctx.newPage();
  await guest.goto(link);
  await expect(
    guest.frameLocator("iframe").getByRole("heading", { name: "격리 도구" }),
  ).toBeVisible();
  expect(await guest.locator("iframe").getAttribute("sandbox")).not.toContain("allow-same-origin");
  const raw = await ctx.request.get(`/api/content/${id}/raw?share=${link.split("/").at(-1)}`);
  expect(raw.headers()["content-security-policy"]).toContain("connect-src 'none'");
  expect(raw.headers()["content-security-policy"]).toContain("form-action 'none'");
  await ctx.close();
});
test("05 공유 해제·비공개 전환·갤러리 공개 경계", async ({ request, browser }) => {
  const { content: c } = await create(request);
  const link = await share(request, c.id);
  const ctx = await browser.newContext({ baseURL: "http://127.0.0.1:3100" });
  expect((await ctx.request.get(`/api/share/${link.split("/").at(-1)}`)).ok()).toBe(true);
  expect((await ctx.request.get("/api/catalog")).ok()).toBe(true);
  const listed = await (await ctx.request.get("/api/catalog")).json();
  expect(listed.contents.some((x: { id: string }) => x.id === c.id)).toBe(false);
  await request.post(`/api/content/${c.id}/revoke`, { data: {} });
  expect((await ctx.request.get(`/api/share/${link.split("/").at(-1)}`)).status()).toBe(404);
  expect(
    (
      await ctx.request.post(`/api/run/${c.id}?share=${link.split("/").at(-1)}`, {
        data: { input: "x" },
      })
    ).status(),
  ).toBe(404);
  await request.patch(`/api/content/${c.id}`, { data: { visibility: "public" } });
  expect((await ctx.request.get(`/api/content/${c.id}`)).ok()).toBe(true);
  await request.patch(`/api/content/${c.id}`, { data: { visibility: "private" } });
  expect((await ctx.request.get(`/api/content/${c.id}`)).status()).toBe(404);
  expect((await request.post(`/api/content/${c.id}/share`, { data: {} })).status()).toBe(400);
  await ctx.close();
});
test("06 복구 키는 편집 권한을 회전하고 이전 키는 무효화", async ({ request, browser }) => {
  const { content: c, recoveryKey } = await create(request);
  const ctx = await browser.newContext({ baseURL: "http://127.0.0.1:3100" });
  const r = await ctx.request.post("/api/recover", { data: { recoveryKey } });
  expect(r.ok()).toBe(true);
  const next = (await r.json()).recoveryKey;
  expect(next).not.toBe(recoveryKey);
  expect(
    (await request.patch(`/api/content/${c.id}`, { data: { title: "old browser" } })).status(),
  ).toBe(403);
  expect(
    (await ctx.request.patch(`/api/content/${c.id}`, { data: { title: "복구 완료" } })).ok(),
  ).toBe(true);
  expect((await request.post("/api/recover", { data: { recoveryKey } })).status()).toBe(403);
  await ctx.close();
});
test("07 내부망 URL·CSRF·본문 크기 제한·편집 비밀값 미노출", async ({ request }) => {
  const blocked = await request.post("/api/content", {
    data: {
      kind: "website",
      title: "내부망",
      description: "",
      category: "work",
      visibility: "link",
      definition,
      url: "https://127.0.0.1",
    },
  });
  expect(blocked.status()).toBe(400);
  expect(
    (
      await request.post("/api/content", { headers: { origin: "https://evil.example" }, data: {} })
    ).status(),
  ).toBe(403);
  const tooBig = await request.post("/api/content", { data: { html: "x".repeat(3_150_000) } });
  expect(tooBig.status()).toBe(413);
  const { content: c } = await create(request);
  const pub = await (await request.get(`/api/content/${c.id}`)).text();
  expect(pub).not.toMatch(/editHash|recoveryHash|tokenHash/);
});
test("08 키 없는 실제 연동 안내·명시적 샘플", async ({ page, request }) => {
  for (const id of ["news", "research", "rates", "companies", "outdoor", "wedding"]) {
    const r = await request.post(`/api/run/${id}`, {
      data: { input: id === "rates" ? "30" : "test" },
    });
    expect(r.status()).toBe(422);
    expect((await r.json()).error.code).toBe("SETUP_REQUIRED");
  }
  await page.goto("/agents/outdoor");
  await page.getByRole("button", { name: "예시 결과 보기", exact: false }).click();
  await expect(page.getByText("샘플 데이터", { exact: true })).toBeVisible();
});
test("09 튜토리얼 세 종류·진행 저장·내 콘텐츠", async ({ page }) => {
  await page.goto("/tutorials");
  await expect(page.locator(".tutorial-card")).toHaveCount(3);
  await page.getByRole("button", { name: "이 단계 완료" }).click();
  await expect(page.getByRole("heading", { name: "예시 자료를 채워요" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "예시 자료를 채워요" })).toBeVisible();
  await page.getByRole("link", { name: "내 에이전트", exact: true }).click();
  await expect(page.getByRole("heading", { name: "내 에이전트", exact: true })).toBeVisible();
});
test("10 HTTPS 외부 웹사이트 공유", async ({ request, page }) => {
  const { content: c } = await create(request, {
    kind: "website",
    title: "공식 자료",
    url: "https://example.com",
  });
  const link = await share(request, c.id);
  await page.goto(link);
  const a = page.getByRole("link", { name: "웹사이트 열기" });
  await expect(a).toHaveAttribute("href", "https://example.com");
  await expect(a).toHaveAttribute("rel", "noreferrer");
});
test("11 브라우저별 실행 제한은 쿠키·서버 기록으로 적용", async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: "http://127.0.0.1:3100" });
  const { content: c } = await create(ctx.request);
  for (let i = 0; i < 30; i++) {
    const r = await ctx.request.post(`/api/run/${c.id}`, {
      data: { input: "실제 입력\n검증\n완료" },
    });
    expect(r.status()).toBe(200);
  }
  const denied = await ctx.request.post(`/api/run/${c.id}`, { data: { input: "추가" } });
  expect(denied.status()).toBe(429);
  expect(denied.headers()["retry-after"]).toBe("900");
  expect((await denied.json()).error.message).toContain("잠시");
  await ctx.close();
});

test("12 공개 IP HTTPS 웹사이트 등록·공유·타 브라우저 열기", async ({ request, page }) => {
  const { content: c } = await create(request, {
    kind: "website",
    title: "공개 HTTPS 웹사이트",
    url: "https://1.1.1.1",
  });
  const link = await share(request, c.id);
  await page.goto(link);
  await expect(
    page.getByRole("heading", { name: "공개 HTTPS 웹사이트", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "웹사이트 열기" })).toHaveAttribute(
    "href",
    "https://1.1.1.1",
  );
});
