import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import Database from "better-sqlite3";
const url = process.env.HUB_DATABASE_URL || `file:${resolve("storage/agent-hub.db")}`;
if (!url.startsWith("file:")) throw new Error("HUB_DATABASE_URL은 SQLite file: URL이어야 합니다.");
const file = url.slice(5);
if (!isAbsolute(file) || file.includes("?"))
  throw new Error("HUB_DATABASE_URL에는 쿼리 없는 절대 SQLite 파일 경로를 사용하세요.");
if (!existsSync(file) || statSync(file).size === 0) {
  mkdirSync(dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("user_version = 0");
  db.close();
  console.log("새 SQLite 파일을 준비했습니다. 기존 데이터는 변경하지 않습니다.");
}
