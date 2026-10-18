import { beforeAll, afterEach, vi } from "vitest";
beforeAll(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("Tests must mock external API requests explicitly"))),
  );
});
afterEach(() => vi.clearAllMocks());
