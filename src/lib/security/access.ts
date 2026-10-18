import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
export const token = () => randomBytes(32).toString("base64url");
export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export class HubError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export type Browser = { id: string; freshToken?: string };
export async function browser(req: NextRequest): Promise<Browser> {
  const cookie = req.cookies.get("hub_browser")?.value;
  if (cookie && /^[A-Za-z0-9_-]{43}$/.test(cookie)) {
    const existing = await db.browser.findUnique({ where: { tokenHash: hash(cookie) } });
    if (existing) return { id: existing.id };
  }
  const freshToken = token();
  const b = await db.browser.create({ data: { id: randomUUID(), tokenHash: hash(freshToken) } });
  return { id: b.id, freshToken };
}
export function setCookie(res: NextResponse, req: NextRequest, name: string, value: string) {
  res.cookies.set(name, value, {
    httpOnly: true,
    secure: process.env.FORCE_SECURE_COOKIES === "1" || req.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
export async function canEdit(req: NextRequest, id: string) {
  const c = await db.content.findUnique({ where: { id } });
  const cookie = req.cookies.get(`hub_edit_${id}`)?.value;
  if (!c || !cookie || hash(cookie) !== c.editHash)
    throw new HubError(
      "FORBIDDEN",
      "이 브라우저에 편집 권한이 없습니다. 복제하거나 복구 키를 사용해 주세요.",
      403,
    );
  return c;
}
export async function readable(req: NextRequest, id: string) {
  const c = await db.content.findUnique({ where: { id } });
  if (!c) throw new HubError("NOT_FOUND", "콘텐츠를 찾을 수 없습니다.", 404);
  const t = req.nextUrl.searchParams.get("share");
  if (t) {
    const share = await db.share.findUnique({ where: { tokenHash: hash(t) } });
    if (
      c.visibility !== "private" &&
      share &&
      share.contentId === id &&
      !share.revoked &&
      (!share.expiresAt || share.expiresAt > new Date())
    )
      return c;
    throw new HubError("NOT_FOUND", "링크가 만료되었거나 공유가 중단되었습니다.", 404);
  }
  if (c.visibility === "public") return c;
  const edit = req.cookies.get(`hub_edit_${id}`)?.value;
  if (edit && hash(edit) === c.editHash) return c;
  throw new HubError("NOT_FOUND", "링크가 만료되었거나 공유가 중단되었습니다.", 404);
}
export function checkOrigin(req: NextRequest) {
  if (["GET", "HEAD"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  const allowed = process.env.APP_BASE_URL
    ? new URL(process.env.APP_BASE_URL).origin
    : req.nextUrl.origin;
  // Next can use its bind address in nextUrl; compare the actual request Host.
  const host = req.headers.get("host");
  const actualOrigin = host ? `${req.nextUrl.protocol}//${host}` : req.nextUrl.origin;
  if (
    req.headers.get("sec-fetch-site") === "cross-site" ||
    (origin && origin !== actualOrigin && origin !== allowed)
  )
    throw new HubError("ORIGIN", "다른 사이트에서 보낸 요청은 허용하지 않습니다.", 403);
}
export async function limitedBody(req: NextRequest, max = 3 * 1024 * 1024) {
  if (Number(req.headers.get("content-length")) > max)
    throw new HubError("BODY_SIZE", "요청이 너무 큽니다. 파일 크기를 줄여 주세요.", 413);
  const reader = req.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) {
        await reader.cancel();
        throw new HubError("BODY_SIZE", "요청 크기 제한을 초과했습니다.", 413);
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (e) {
    if (e instanceof HubError) throw e;
    throw new HubError("JSON", "요청 형식을 확인해 주세요.");
  }
}
export async function rateLimit(key: string, max = 30, windowMs = 15 * 60_000) {
  const now = new Date();
  const count = await db.$transaction(async (tx) => {
    const row = await tx.throttle.findUnique({ where: { key } });
    if (!row || row.expiresAt <= now) {
      await tx.throttle.upsert({
        where: { key },
        create: { key, count: 1, expiresAt: new Date(+now + windowMs) },
        update: { count: 1, expiresAt: new Date(+now + windowMs) },
      });
      return 1;
    }
    return (await tx.throttle.update({ where: { key }, data: { count: { increment: 1 } } })).count;
  });
  if (count > max)
    throw new HubError(
      "RATE_LIMIT",
      "잠시 쉬어가세요. 사용량 제한에 도달했습니다. 15분 후 다시 시도해 주세요.",
      429,
    );
}
export function requestIp(req: NextRequest) {
  if (process.env.HUB_SOCKET_IP === "1") return req.headers.get("x-hub-client-ip") || "unknown";
  return process.env.TRUST_PROXY === "1"
    ? req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown"
    : "local-network";
}
