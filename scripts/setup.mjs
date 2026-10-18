import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
const major = Number(process.versions.node.split(".")[0]);
if (major < 22) {
  console.error("Node.js 22.12 이상 또는 24 LTS가 필요합니다.");
  process.exit(1);
}
mkdirSync("storage", { recursive: true });
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
for (const [command, args] of [
  [npm, ["ci", "--cache", ".cache/npm", "--no-audit", "--no-fund"]],
  [npm, ["run", "db:generate"]],
  [process.execPath, ["scripts/prepare-db.mjs"]],
  [npx, ["prisma", "migrate", "deploy"]],
  [npm, ["run", "db:seed"]],
]) {
  const r = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32" && /\.cmd$/i.test(command),
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
console.log("준비 완료. npm run dev:lan 또는 npm run build 후 npm run start:lan");
