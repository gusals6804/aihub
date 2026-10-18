import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
mkdirSync(resolve("storage"), { recursive: true });
const globalDb = globalThis as unknown as { hubDb?: PrismaClient };
export const db =
  globalDb.hubDb ??
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: process.env.HUB_DATABASE_URL || "file:./storage/agent-hub.db",
    }),
  });
if (process.env.NODE_ENV !== "production") globalDb.hubDb = db;
