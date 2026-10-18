import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";
import { once } from "node:events";

process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const args = process.argv.slice(2);
const binary = process.env.CLOUDFLARED_BIN || "cloudflared";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
let tunnel, server, temporary;
let stopping = false;
function run(command, argv) {
  const r = spawnSync(command, argv, {
    stdio: "inherit",
    shell: process.platform === "win32" && /\.cmd$/i.test(command),
  });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${command} ${argv.join(" ")} 실패 (${r.status})`);
}
async function stop() {
  if (stopping) return;
  stopping = true;
  await Promise.all(
    [server, tunnel].filter(Boolean).map(async (child) => {
      if (child.exitCode !== null) return;
      const finished = once(child, "exit");
      child.kill("SIGTERM");
      const force = setTimeout(() => child.kill("SIGKILL"), 4000);
      force.unref();
      await finished;
      clearTimeout(force);
    }),
  );
  if (temporary) rmSync(temporary, { recursive: true, force: true });
}
async function freePort(start) {
  for (let port = start; port < start + 20; port++) {
    const free = await new Promise((resolve) => {
      const probe = net.createServer();
      probe.once("error", () => resolve(false));
      probe.listen(port, "127.0.0.1", () => probe.close(() => resolve(true)));
    });
    if (free) return port;
  }
  throw new Error("사용 가능한 로컬 포트가 없습니다. 다른 --port 값을 사용하세요.");
}
async function address(port) {
  temporary = mkdtempSync(join(tmpdir(), "agent-hub-share-"));
  const config = join(temporary, "quick.yml");
  writeFileSync(config, "loglevel: info\n", { mode: 0o600 });
  return new Promise((resolve, reject) => {
    // Explicit configuration preserves existing named-tunnel credentials/configuration.
    tunnel = spawn(
      binary,
      [
        "tunnel",
        "--config",
        config,
        "--url",
        `http://127.0.0.1:${port}`,
        "--protocol",
        "http2",
        "--no-autoupdate",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let recent = "";
    const deadline = setTimeout(
      () =>
        reject(
          new Error(
            "임시 주소 발급 시간이 초과되었습니다. Cloudflare 연결과 회사 네트워크 정책을 확인하세요.",
          ),
        ),
      45000,
    );
    const read = (chunk) => {
      recent = (recent + chunk.toString()).slice(-12000);
      const match = recent.match(/https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com\b/);
      if (match) {
        clearTimeout(deadline);
        resolve(match[0]);
      }
    };
    tunnel.stdout.on("data", read);
    tunnel.stderr.on("data", read);
    tunnel.once("error", (e) => {
      clearTimeout(deadline);
      reject(e);
    });
    tunnel.once("exit", (code) => {
      clearTimeout(deadline);
      reject(
        new Error(
          `Cloudflare가 주소를 발급하지 못했습니다 (${code}). 네트워크 차단 또는 Cloudflare 상태를 확인하세요.`,
        ),
      );
    });
  });
}
async function ready(port) {
  for (let i = 0; i < 150; i++) {
    if (server.exitCode !== null || tunnel.exitCode !== null)
      throw new Error("공유 프로세스가 시작 중 종료되었습니다.");
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/catalog`, {
        signal: AbortSignal.timeout(1000),
      });
      if (r.ok && (await r.json()).builtins?.length === 7) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("로컬 앱이 준비되지 않았습니다. 서버 로그를 확인하세요.");
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => void stop().then(() => process.exit(0)));
try {
  const version = spawnSync(binary, ["--version"], { encoding: "utf8" });
  if (version.error || version.status !== 0)
    throw new Error(
      "cloudflared가 필요합니다. Windows: winget install --id Cloudflare.cloudflared --exact (설치 후 새 터미널) / macOS: brew install cloudflared / Linux: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/",
    );
  console.log(
    "서버와 임시 HTTPS 공유 주소를 준비합니다. 주소를 가진 누구나 앱에 접속할 수 있습니다.",
  );
  if (!existsSync("node_modules/next") || !existsSync("src/generated/prisma/client.ts"))
    run(npm, ["run", "setup"]);
  else {
    mkdirSync("storage", { recursive: true });
    run(process.execPath, ["scripts/prepare-db.mjs"]);
    run(npm, ["run", "db:generate"]);
    run(npx, ["prisma", "migrate", "deploy"]);
  }
  if (!args.includes("--skip-build")) run(npm, ["run", "build"]);
  if (!existsSync(".next/BUILD_ID"))
    throw new Error("프로덕션 빌드가 없습니다. npm run build를 먼저 실행하세요.");
  const index = args.indexOf("--port");
  const first = index >= 0 ? Number(args[index + 1]) : 3000;
  if (!Number.isInteger(first) || first < 1024 || first > 65515)
    throw new Error("포트는 1024~65515 범위의 숫자여야 합니다.");
  const port = await freePort(first);
  console.log("Cloudflare 임시 주소를 발급하고 있습니다…");
  const url = await address(port);
  server = spawn(
    process.execPath,
    ["scripts/serve.mjs", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, APP_BASE_URL: url, FORCE_SECURE_COOKIES: "1", TRUST_PROXY: "0" },
    },
  );
  server.stderr.on("data", (chunk) => process.stderr.write(chunk));
  await ready(port);
  console.log(
    `\n공유 주소: ${url}\n\n이 주소를 동료에게 전달하세요. Ctrl+C로 앱과 터널을 함께 종료합니다.\n터널을 다시 시작하면 주소가 바뀌며, 노트북이 꺼지면 접속이 중단됩니다.\n공용 API 키·기존 .env·기존 터널 설정은 변경하지 않았습니다.\n`,
  );
  // A tunnel may issue a URL before its edge connection is available. Do not claim
  // external reachability solely from the local readiness check.
  console.log("위 주소를 휴대전화의 다른 네트워크에서 열어 외부 연결도 확인하세요.");
  const ended = await Promise.race([
    once(server, "exit").then(() => "앱"),
    once(tunnel, "exit").then(() => "터널"),
  ]);
  if (!stopping) throw new Error(`${ended} 프로세스가 종료되어 공유를 중단합니다.`);
} catch (e) {
  console.error(`\n공유 시작 실패: ${e.message}`);
  await stop();
  process.exitCode = 1;
}
