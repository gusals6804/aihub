import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";
const dir = mkdtempSync(join(tmpdir(), "hub-e2e-"));
const file = join(dir, "test.db");
const db = new Database(file);
db.exec(readFileSync("prisma/migrations/202610180001_anonymous/migration.sql", "utf8"));
db.close();
const child = spawn(process.execPath, ["scripts/serve.mjs", "3100"], {
  stdio: "inherit",
  env: {
    ...process.env,
    HUB_DATABASE_URL: `file:${file}`,
    RUN_IP_LIMIT: "1000",
    NAVER_CLIENT_ID: "",
    NAVER_CLIENT_SECRET: "",
    FRED_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    KAKAO_REST_API_KEY: "",
    DART_API_KEY: "",
    FORCE_SECURE_COOKIES: "0",
  },
});
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => child.kill(s));
child.on("exit", (c) => process.exit(c ?? 1));
