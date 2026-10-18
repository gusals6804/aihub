import { describe, expect, test, vi } from "vitest";
import { analyzeCsv, parseFile, runAgent } from "@/lib/agents/engine";
import { publicIp, safeUrl } from "@/lib/security/url";
import { builtins } from "@/lib/agents/catalog";
import { hash, token } from "@/lib/security/access";
import ExcelJS from "exceljs";

describe("actual calculations and file parsing", () => {
  test("exactly seven builtins: five work and two personal", () => {
    expect(builtins).toHaveLength(7);
    expect(builtins.filter((b) => b.category === "work")).toHaveLength(5);
    expect(builtins.some((b) => b.title.includes("여행"))).toBe(false);
  });
  test("analyzes actual uploaded values and detects mixed dates", () => {
    const r = analyzeCsv("name,return,fee,date\nA,10,0.2,2026-01-01\nB,20,0.1,2026-01-02", true);
    expect(r.rows?.[0].return).toBe(10);
    expect(r.text).toContain("15.0000");
    expect(r.warnings.some((w) => w.includes("서로 다른"))).toBe(true);
    expect(r.warnings.some((w) => w.includes("변동성"))).toBe(true);
  });
  test("computes observation returns volatility from actual prices", () => {
    const r = analyzeCsv(
      "name,date,price\nA,2026-01-01,100\nA,2026-01-02,110\nA,2026-01-03,99",
      true,
    );
    expect(r.text).toContain("14.142%");
  });
  test("rejects malformed CSV and disguised binary uploads", async () => {
    expect(() => analyzeCsv("nothing")).toThrow();
    await expect(
      parseFile({ name: "fake.xlsx", data: Buffer.from("hello").toString("base64") }),
    ).rejects.toThrow();
    await expect(parseFile({ name: "data.exe", data: "YWJj" })).rejects.toThrow();
  });
  test("parses actual XLSX content", async () => {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("ETF");
    sheet.addRow(["name", "fee"]);
    sheet.addRow(["A", 0.1]);
    const bytes = await book.xlsx.writeBuffer();
    const text = await parseFile({ name: "etf.xlsx", data: Buffer.from(bytes).toString("base64") });
    expect(analyzeCsv(text).rows?.[0].fee).toBe(0.1);
  });
  test("structured custom agents execute without AI or invented data", async () => {
    const r = await runAgent(
      "",
      { type: "structured", variables: "주제,할 일" },
      { input: "회의\n자료 확인" },
    );
    expect(r.rows).toEqual([
      { 항목: "주제", 내용: "회의" },
      { 항목: "할 일", 내용: "자료 확인" },
    ]);
  });
  test("missing keys fail honestly and samples are explicitly marked", async () => {
    vi.stubEnv("KAKAO_REST_API_KEY", "");
    await expect(runAgent("outdoor", { type: "places" }, { input: "강남" })).rejects.toMatchObject({
      code: "SETUP_REQUIRED",
    });
    const r = await runAgent("outdoor", { type: "places" }, { input: "", sample: true });
    expect(r.status).toBe("sample");
    expect(r.warnings[0]).toContain("샘플");
  });
});
describe("network and capability boundaries", () => {
  test.each([
    "127.0.0.1",
    "10.1.1.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.1.1",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
    "2002:7f00:1::",
  ])("blocks internal/reserved %s", (ip) => expect(publicIp(ip)).toBe(false));
  test("allows ordinary public IPv4 and IPv6", () => {
    expect(publicIp("8.8.8.8")).toBe(true);
    expect(publicIp("2606:4700::1111")).toBe(true);
  });
  test.each([
    "http://example.com",
    "https://user:pass@example.com",
    "https://example.com:8443",
    "https://127.0.0.1",
    "https://[::1]",
  ])("rejects unsafe URL %s", async (url) => {
    await expect(safeUrl(url)).rejects.toThrow();
  });
  test("produces high entropy distinct tokens and one-way hashes", () => {
    const a = token(),
      b = token();
    expect(a).toHaveLength(43);
    expect(a).not.toBe(b);
    expect(hash(a)).toHaveLength(64);
    expect(hash(a)).not.toContain(a);
  });
});

test("cloned ETF retains financial analysis and sample identity", async () => {
  const r = await runAgent(
    "",
    { type: "csv", builtinId: "etf" },
    { input: "name,date,price\nA,2026-01-01,100\nA,2026-01-02,110\nA,2026-01-03,99" },
  );
  expect(r.text).toContain("14.142%");
});

test("extracts actual English text from a PDF file", async () => {
  const { readFileSync } = await import("node:fs");
  const pdf = readFileSync("tests/fixtures/research.pdf");
  const text = await parseFile({ name: "research.pdf", data: pdf.toString("base64") });
  expect(text).toContain("Revenue increased by 12 percent.");
});
