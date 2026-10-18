import { test, expect, vi } from "vitest";
vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));
import { lookup } from "node:dns/promises";
import { safeUrl } from "@/lib/security/url";
const mocked = vi.mocked(lookup);
test("public HTTPS hostname validation retains DNS evidence", async () => {
  mocked.mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }] as never);
  const r = await safeUrl("https://example.com/tool");
  expect(r.url.hostname).toBe("example.com");
  expect(r.address.address).toBe("93.184.216.34");
});
test("mixed public/private DNS and mapped private IPv6 fail closed", async () => {
  mocked.mockResolvedValueOnce([
    { address: "93.184.216.34", family: 4 },
    { address: "127.0.0.1", family: 4 },
  ] as never);
  await expect(safeUrl("https://internal.example")).rejects.toMatchObject({ code: "SSRF" });
  mocked.mockResolvedValueOnce([{ address: "::ffff:127.0.0.1", family: 6 }] as never);
  await expect(safeUrl("https://internal.example")).rejects.toMatchObject({ code: "SSRF" });
});
test("DNS failure is actionable and never bypasses address validation", async () => {
  mocked.mockRejectedValueOnce(new Error("EAI_AGAIN"));
  await expect(safeUrl("https://example.com")).rejects.toMatchObject({ code: "URL" });
});
