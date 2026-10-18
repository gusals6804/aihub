import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const args = process.argv.slice(2);
const index = args.indexOf("--port");
const port = index < 0 ? 3000 : Number(args[index + 1]);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("포트는 1024~65535 범위여야 합니다.");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const env = {
  ...process.env,
  APP_BASE_URL: `http://localhost:${port}`,
  FORCE_SECURE_COOKIES: "0",
  TRUST_PROXY: "0",
};
function run(command, argv) {
  const r = spawnSync(command, argv, {
    stdio: "inherit",
    env,
    shell: process.platform === "win32" && /\.cmd$/i.test(command),
  });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status ?? 1);
}
if (!existsSync("node_modules/next") || !existsSync("src/generated/prisma/client.ts"))
  run(npm, ["run", "setup"]);
else {
  run(process.execPath, ["scripts/prepare-db.mjs"]);
  run(npm, ["run", "db:generate"]);
  run(npx, ["prisma", "migrate", "deploy"]);
}
if (!args.includes("--skip-build")) run(npm, ["run", "build"]);
const child = spawn(
  process.execPath,
  ["scripts/serve.mjs", "--hostname", "0.0.0.0", "--port", String(port)],
  { stdio: "inherit", env },
);
child.on("error", (e) => {
  console.error(e.message);
  process.exitCode = 1;
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
