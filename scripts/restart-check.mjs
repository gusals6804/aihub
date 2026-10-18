import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
const dir = mkdtempSync(join(tmpdir(), "hub-restart-"));
const file = join(dir, "test.db");
const db = new Database(file);
db.exec(readFileSync("prisma/migrations/202610180001_anonymous/migration.sql", "utf8"));
db.close();
const root = "http://127.0.0.1:3200";
let child;
let cookie = "";
async function start() {
  child = spawn(process.execPath, ["scripts/serve.mjs", "3200"], {
    stdio: ["ignore", "ignore", "pipe"],
    env: { ...process.env, HUB_DATABASE_URL: `file:${file}`, FORCE_SECURE_COOKIES: "0" },
  });
  for (let n = 0; n < 100; n++) {
    try {
      if ((await fetch(root)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("server not ready");
}
async function stop() {
  if (child && child.exitCode === null) {
    const p = once(child, "exit");
    child.kill("SIGTERM");
    await p;
  }
}
async function request(path, body) {
  const r = await fetch(root + "/api/" + path, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json", cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = r.headers.getSetCookie();
  if (set.length)
    cookie = [
      ...new Map(
        [...cookie.split("; ").filter(Boolean), ...set.map((s) => s.split(";")[0])].map((s) => [
          s.split("=")[0],
          s,
        ]),
      ).values(),
    ].join("; ");
  assert.equal(r.status, body && path === "content" ? 201 : 200);
  return r.json();
}
try {
  await start();
  const c = await request("content", {
    kind: "agent",
    title: "restart persistence",
    description: "",
    category: "work",
    visibility: "link",
    definition: { type: "structured", variables: "title,body" },
  });
  const s = await request(`content/${c.content.id}/share`, {});
  const t = s.path.split("/").at(-1);
  await stop();
  await start();
  const shared = await request(`share/${t}`);
  assert.equal(shared.content.title, "restart persistence");
  const r = await request(`run/${c.content.id}?share=${t}`, { input: "after restart\nworks" });
  assert.equal(r.result.rows[0].내용, "after restart");
  console.log(
    "PASS: server restart preserves content, share link, edit cookie, and actual execution",
  );
} finally {
  await stop();
  rmSync(dir, { recursive: true, force: true });
}
