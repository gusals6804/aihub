import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
const dir = mkdtempSync(join(tmpdir(), "hub-limits-"));
const file = join(dir, "test.db");
const db = new Database(file);
db.exec(readFileSync("prisma/migrations/202610180001_anonymous/migration.sql", "utf8"));
db.close();
const root = "http://127.0.0.1:3201";
const child = spawn(process.execPath, ["scripts/serve.mjs", "3201"], {
  stdio: ["ignore", "ignore", "pipe"],
  env: {
    ...process.env,
    HUB_DATABASE_URL: `file:${file}`,
    RUN_IP_LIMIT: "2",
    RUN_SESSION_LIMIT: "100",
    TRUST_PROXY: "0",
  },
});
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(root)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(ready, "server ready");
  for (let i = 0; i < 3; i++) {
    const r = await fetch(root + "/api/run/etf", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": `8.8.8.${i}`,
        "x-hub-client-ip": `1.1.1.${i}`,
      },
      body: JSON.stringify({ input: "name,fee,date\nA,0.1,2026-01-01" }),
    });
    assert.equal(r.status, i < 2 ? 200 : 429);
  }
  console.log("PASS: socket IP throttling survives fresh sessions and spoofed forwarding headers");
} finally {
  if (child.exitCode === null) {
    const exit = once(child, "exit");
    child.kill("SIGTERM");
    await exit;
  }
  rmSync(dir, { recursive: true, force: true });
}
