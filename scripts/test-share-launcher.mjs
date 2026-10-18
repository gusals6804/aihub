import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
const dir = mkdtempSync(join(tmpdir(), "hub-share-launcher-"));
const mock = join(dir, "cloudflared-fixture");
writeFileSync(
  mock,
  '#!/usr/bin/env node\nif(process.argv.includes("--version")){console.log("cloudflared version test-fixture");process.exit(0);}\nconsole.error("https://launcher-fixture.trycloudflare.com");setInterval(()=>{},1000);\n',
  { mode: 0o755 },
);
const child = spawn(process.execPath, ["scripts/share.mjs", "--skip-build", "--port", "3210"], {
  env: { ...process.env, CLOUDFLARED_BIN: mock, HUB_DATABASE_URL: `file:${join(dir, "test.db")}` },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
child.stdout.on("data", (c) => (output += c));
child.stderr.on("data", (c) => (output += c));
try {
  let ready = false;
  for (let i = 0; i < 250; i++) {
    if (child.exitCode !== null) throw new Error("Launcher exited: " + output);
    if (output.includes("공유 주소:")) {
      ready = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(ready, "launcher became ready");
  const r = await fetch("http://127.0.0.1:3210/api/content", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://launcher-fixture.trycloudflare.com",
      host: "launcher-fixture.trycloudflare.com",
    },
    body: JSON.stringify({
      kind: "agent",
      title: "launcher check",
      description: "",
      category: "work",
      visibility: "link",
      definition: { type: "structured" },
    }),
  });
  assert.equal(r.status, 201);
  const cookies = r.headers.getSetCookie();
  assert.ok(cookies.every((c) => /; Secure/i.test(c)));
  assert.ok(cookies.every((c) => /; HttpOnly/i.test(c)));
  const cookie = cookies.map((c) => c.split(";")[0]).join("; ");
  const { content } = await r.json();
  const share = await fetch(`http://127.0.0.1:3210/api/content/${content.id}/share`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
      origin: "https://launcher-fixture.trycloudflare.com",
      host: "launcher-fixture.trycloudflare.com",
    },
    body: "{}",
  });
  assert.equal(share.status, 200);
  const finished = once(child, "exit");
  child.kill("SIGTERM");
  await finished;
  await assert.rejects(fetch("http://127.0.0.1:3210/api/catalog"));
  console.log(
    "PASS: launcher starts real app, accepts HTTPS origin, issues Secure/HttpOnly edit cookies, creates a share, and cleans up children. Tunnel output was a local test fixture; no external connectivity claimed.",
  );
} finally {
  if (child.exitCode === null) {
    const ended = once(child, "exit");
    child.kill("SIGTERM");
    await ended;
  }
  rmSync(dir, { recursive: true, force: true });
}
