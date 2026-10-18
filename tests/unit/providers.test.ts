import { describe, expect, test, vi, afterEach } from "vitest";
import { runAgent } from "@/lib/agents/engine";
import { isolateHtml } from "@/lib/security/html";
import { limitedBody, checkOrigin } from "@/lib/security/access";
import { NextRequest } from "next/server";
afterEach(() => vi.unstubAllEnvs());
const respond = (value: unknown) =>
  new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
describe("official provider contracts (mocked, not live credentials)", () => {
  test("Naver deduplicates articles, preserves sources and admits no AI", async () => {
    vi.stubEnv("NAVER_CLIENT_ID", "test");
    vi.stubEnv("NAVER_CLIENT_SECRET", "test");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const item = {
      title: "<b>뉴스</b>",
      description: "실제 내용",
      originallink: "https://example.com/article",
      pubDate: new Date().toUTCString(),
    };
    vi.mocked(fetch).mockResolvedValueOnce(respond({ items: [item, item] }));
    const r = await runAgent("news", { type: "news" }, { input: "시장" });
    expect(r.rows).toHaveLength(1);
    expect(r.rows?.[0].제목).toBe("뉴스");
    expect(r.status).toBe("partial");
    expect(r.warnings.some((w) => w.includes("AI 분석을 수행하지 않았습니다"))).toBe(true);
  });
  test("FRED computes spread and changes, retaining observation dates", async () => {
    vi.stubEnv("FRED_API_KEY", "test");
    vi.mocked(fetch).mockImplementation(async (url) => {
      const series = new URL(String(url)).searchParams.get("series_id");
      return respond({
        observations: [
          {
            date: "2026-01-01",
            value: series === "DEXKOUS" ? "1400" : series === "DGS2" ? "4" : "4.5",
          },
          {
            date: "2026-01-02",
            value: series === "DEXKOUS" ? "1410" : series === "DGS2" ? "4.1" : "4.7",
          },
          { date: "2026-01-03", value: "." },
        ],
      });
    });
    const r = await runAgent("rates", { type: "rates" }, { input: "30" });
    expect(r.rows).toHaveLength(2);
    expect(r.rows?.[1]["10년-2년(%p)"]).toBe(0.6);
    expect(r.text).toContain("10.0000");
    expect(r.sources).toHaveLength(3);
  });
  test("Kakao radius is applied only with coordinates; places do not prove corporate status", async () => {
    vi.stubEnv("KAKAO_REST_API_KEY", "test");
    vi.mocked(fetch).mockResolvedValueOnce(
      respond({
        documents: [
          {
            place_name: "확인된 장소",
            address_name: "서울",
            phone: "",
            place_url: "https://place.map.kakao.com/1",
            x: "127",
            y: "37",
            distance: "500",
            category_name: "기업",
          },
        ],
      }),
    );
    const r = await runAgent(
      "companies",
      { type: "companies" },
      { input: "기업", options: { x: 127, y: 37, radius: 1000, count: 5 } },
    );
    expect(r.rows?.[0].이름).toBe("확인된 장소");
    expect(r.warnings.some((w) => w.includes("법인 여부 미확인"))).toBe(true);
    const call = vi.mocked(fetch).mock.calls.at(-1)!;
    expect(String(call[0])).toContain("radius=1000");
  });
  test("provider errors never expose upstream credentials", async () => {
    vi.stubEnv("FRED_API_KEY", "test-secret");
    vi.mocked(fetch).mockRejectedValue(new Error("test-secret"));
    await expect(runAgent("rates", { type: "rates" }, { input: "30" })).rejects.toMatchObject({
      code: "PROVIDER",
      message: expect.not.stringContaining("test-secret"),
    });
  });
});
describe("hostile uploads and requests", () => {
  test("strips active HTML including navigation, events, remote media and scripts", () => {
    const html = isolateHtml(
      '<meta http-equiv="refresh" content="0;url=https://evil.test"><script>fetch("/secret")</script><a href="https://127.0.0.1">go</a><img src="https://evil.test" onerror="alert(1)"><iframe src="/api/status"></iframe><svg onload="alert(2)"></svg><h1>safe title</h1>',
    );
    expect(html).toContain("<h1>safe title</h1>");
    expect(html).not.toMatch(/<script|<iframe|<meta|<svg|href=|onerror=|https:/i);
  });
  test("streaming body limit also applies without content-length", async () => {
    const req = new NextRequest("http://localhost/api/content", {
      method: "POST",
      body: JSON.stringify({ data: "x".repeat(100) }),
    });
    await expect(limitedBody(req, 30)).rejects.toMatchObject({ status: 413 });
  });
  test("rejects cross-site writes even if origin is omitted", () => {
    const req = new NextRequest("http://localhost/api/content", {
      method: "POST",
      headers: { "sec-fetch-site": "cross-site" },
    });
    expect(() => checkOrigin(req)).toThrow();
  });
});

describe("output contract", () => {
  test("validates model JSON rather than merely saving an output description", async () => {
    const { outputShape, validateOutput } = await import("@/lib/agents/output");
    const spec = outputShape('{"title":"string","verified":"boolean"}');
    expect(validateOutput('{"title":"text","verified":true}', spec)).toContain('"verified": true');
    expect(() => validateOutput('{"title":"text","verified":"yes"}', spec)).toThrow();
    expect(() => outputShape('{"x":"function"}')).toThrow();
  });
});

test("transient provider failures retry once without weakening verification", async () => {
  vi.stubEnv("FRED_API_KEY", "test");
  let first = true;
  vi.mocked(fetch).mockImplementation(async () => {
    if (first) {
      first = false;
      return new Response("", { status: 503 });
    }
    return respond({ observations: [{ date: "2026-01-01", value: "4" }] });
  });
  const r = await runAgent("rates", { type: "rates" }, { input: "7" });
  expect(r.rows).toHaveLength(1);
  expect(fetch).toHaveBeenCalledTimes(4);
});
