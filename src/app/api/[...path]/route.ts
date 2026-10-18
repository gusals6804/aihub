import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db/client";
import {
  browser,
  canEdit,
  checkOrigin,
  hash,
  HubError,
  limitedBody,
  rateLimit,
  readable,
  requestIp,
  setCookie,
  token,
  type Browser,
} from "@/lib/security/access";
import { safeUrl } from "@/lib/security/url";
import { isolateHtml } from "@/lib/security/html";
import { catalog, findBuiltin, type Definition } from "@/lib/agents/catalog";
import { runAgent } from "@/lib/agents/engine";
import type { Content } from "@/generated/prisma/client";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const definitionSchema = z.object({
  builtinId: z
    .enum(["news", "etf", "research", "rates", "companies", "outdoor", "wedding"])
    .optional(),
  type: z.enum([
    "prompt",
    "translation",
    "csv",
    "structured",
    "url-summary",
    "news",
    "rates",
    "companies",
    "places",
  ]),
  prompt: z.string().max(10000).optional(),
  inputLabel: z.string().max(100).optional(),
  output: z.string().max(500).optional(),
  source: z.string().max(300).optional(),
  variables: z.string().max(2000).optional(),
  schema: z.string().max(4000).optional(),
});
const contentSchema = z.object({
  kind: z.enum(["agent", "html", "website"]),
  title: z.string().trim().min(1).max(100),
  description: z.string().max(500),
  category: z.enum(["work", "personal"]),
  visibility: z.enum(["private", "link", "public"]).default("link"),
  definition: definitionSchema,
  html: z.string().max(2_000_000).optional(),
  url: z.string().max(2048).optional(),
});
const runSchema = z.object({
  input: z.string().max(500_000).default(""),
  sample: z.boolean().optional(),
  file: z.object({ name: z.string().max(200), data: z.string().max(2_700_000) }).optional(),
  options: z
    .object({
      radius: z.number().optional(),
      x: z.number().min(-180).max(180).optional(),
      y: z.number().min(-90).max(90).optional(),
      count: z.number().optional(),
      corpCode: z.string().optional(),
      date: z.string().max(100).optional(),
      guests: z.string().max(100).optional(),
      budget: z.string().max(100).optional(),
    })
    .optional(),
});
const serialize = (c: Content, owned = false) => ({
  id: c.id,
  title: c.title,
  description: c.description,
  category: c.category,
  kind: c.kind,
  visibility: c.visibility,
  definition: JSON.parse(c.definition),
  url: c.url,
  owned,
  version: c.version,
  createdAt: c.createdAt.toISOString(),
});
let active = 0;
async function handler(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  let b: Browser | undefined;
  const extraCookies: [string, string][] = [];
  const reply = (value: unknown, status = 200) => {
    const res = NextResponse.json(value, {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
    if (b?.freshToken) setCookie(res, req, "hub_browser", b.freshToken);
    extraCookies.forEach(([name, value]) => setCookie(res, req, name, value));
    return res;
  };
  try {
    checkOrigin(req);
    const { path } = await context.params;
    const [area, id, action] = path;
    b = await browser(req);
    if (req.method !== "GET") {
      await rateLimit(`write-ip:${hash(requestIp(req))}`, 120);
      await rateLimit(`write-browser:${b.id}`, 80);
    }
    if (area === "catalog" && req.method === "GET") {
      const rows = await db.content.findMany({
        where:
          req.nextUrl.searchParams.get("mine") === "1"
            ? { creatorId: b.id }
            : { visibility: "public" },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      return reply({
        builtins: catalog,
        contents: rows.map((c) =>
          serialize(
            c,
            c.creatorId === b!.id &&
              hash(req.cookies.get(`hub_edit_${c.id}`)?.value || "") === c.editHash,
          ),
        ),
      });
    }
    if (area === "status" && req.method === "GET") {
      return reply({
        integrations: [
          "NAVER_CLIENT_ID",
          "NAVER_CLIENT_SECRET",
          "KAKAO_REST_API_KEY",
          "DART_API_KEY",
          "FRED_API_KEY",
          "ANTHROPIC_API_KEY",
        ].map((name) => ({ name, connected: Boolean(process.env[name]) })),
        operatorManaged: true,
      });
    }
    if (area === "content" && !id && req.method === "POST") {
      const data = contentSchema.parse(await limitedBody(req));
      if (
        data.kind === "html" &&
        (!data.html ||
          !/<(?:!doctype|html|body|div|h[1-6]|p|section)/i.test(data.html) ||
          data.html.includes("\0"))
      )
        throw new HubError("HTML", "단일 HTML 텍스트 파일을 업로드해 주세요.");
      if (data.kind === "website") {
        if (!data.url) throw new HubError("URL", "웹사이트 주소를 입력해 주세요.");
        await safeUrl(data.url);
      }
      const editToken = token(),
        recoveryKey = token(),
        contentId = randomUUID();
      const c = await db.content.create({
        data: {
          id: contentId,
          creatorId: b.id,
          ...data,
          definition: JSON.stringify(data.definition),
          html: data.kind === "html" ? data.html : null,
          url: data.kind === "website" ? data.url : null,
          editHash: hash(editToken),
          recoveryHash: hash(recoveryKey),
        },
      });
      extraCookies.push([`hub_edit_${c.id}`, editToken]);
      return reply({ content: serialize(c, true), recoveryKey }, 201);
    }
    if (area === "recover" && req.method === "POST") {
      await rateLimit(`recover:${hash(requestIp(req))}`, 10);
      const { recoveryKey } = z
        .object({ recoveryKey: z.string().length(43) })
        .parse(await limitedBody(req, 4096));
      const c = await db.content.findUnique({ where: { recoveryHash: hash(recoveryKey) } });
      if (!c) throw new HubError("RECOVERY", "복구 키를 확인해 주세요.", 403);
      const editToken = token(),
        nextRecovery = token();
      const changed = await db.content.updateMany({
        where: { id: c.id, recoveryHash: hash(recoveryKey) },
        data: { creatorId: b.id, editHash: hash(editToken), recoveryHash: hash(nextRecovery) },
      });
      if (changed.count !== 1) throw new HubError("RECOVERY", "이미 사용된 복구 키입니다.", 403);
      extraCookies.push([`hub_edit_${c.id}`, editToken]);
      return reply({ id: c.id, recoveryKey: nextRecovery });
    }
    if (area === "content" && id) {
      if (action === "raw" && req.method === "GET") {
        const c = await readable(req, id);
        if (c.kind !== "html") throw new HubError("NOT_FOUND", "HTML이 없습니다.", 404);
        return new NextResponse(isolateHtml(c.html || ""), {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Security-Policy":
              "sandbox; default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'",
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "no-referrer",
            "Cache-Control": "no-store",
          },
        });
      }
      if (action === "share" && req.method === "POST") {
        const c = await canEdit(req, id);
        if (c.visibility === "private")
          throw new HubError("PRIVATE", "공유 범위를 링크 공유 또는 갤러리 공개로 바꿔 주세요.");
        const { days } = z
          .object({ days: z.number().int().min(0).max(365).default(0) })
          .parse(await limitedBody(req, 4096));
        const raw = token();
        await db.share.create({
          data: {
            id: randomUUID(),
            contentId: id,
            tokenHash: hash(raw),
            expiresAt: days ? new Date(Date.now() + days * 86400000) : null,
          },
        });
        return reply({ path: `/share/${raw}` });
      }
      if (action === "revoke" && req.method === "POST") {
        await canEdit(req, id);
        await db.share.updateMany({ where: { contentId: id }, data: { revoked: true } });
        return reply({ ok: true });
      }
      if (action === "clone" && req.method === "POST") {
        const builtin = findBuiltin(id);
        const c = builtin ? undefined : await readable(req, id);
        const edit = token(),
          recoveryKey = token(),
          newId = randomUUID();
        const clone = await db.content.create({
          data: {
            id: newId,
            creatorId: b.id,
            kind: c?.kind || "agent",
            title: `${c?.title || builtin!.title} (복제)`,
            description: c?.description || builtin!.description,
            category: c?.category || builtin!.category,
            visibility: "link",
            definition:
              c?.definition || JSON.stringify({ type: builtin!.type, builtinId: builtin!.id }),
            html: c?.html,
            url: c?.url,
            editHash: hash(edit),
            recoveryHash: hash(recoveryKey),
          },
        });
        extraCookies.push([`hub_edit_${newId}`, edit]);
        return reply({ content: serialize(clone, true), recoveryKey }, 201);
      }
      if (!action && req.method === "GET") {
        const builtin = catalog.find((a) => a.id === id);
        if (builtin) return reply({ content: builtin });
        const c = await readable(req, id);
        return reply({
          content: serialize(
            c,
            hash(req.cookies.get(`hub_edit_${id}`)?.value || "") === c.editHash,
          ),
        });
      }
      if (!action && req.method === "PATCH") {
        const c = await canEdit(req, id);
        const patch = contentSchema
          .omit({ kind: true, html: true })
          .partial()
          .parse(await limitedBody(req, 30_000));
        if (patch.url) await safeUrl(patch.url);
        const updated = await db.content.update({
          where: { id },
          data: {
            ...patch,
            definition: patch.definition ? JSON.stringify(patch.definition) : c.definition,
            version: { increment: 1 },
          },
        });
        if (patch.visibility === "private")
          await db.share.updateMany({ where: { contentId: id }, data: { revoked: true } });
        return reply({ content: serialize(updated, true) });
      }
      if (!action && req.method === "DELETE") {
        await canEdit(req, id);
        await db.$transaction([
          db.share.deleteMany({ where: { contentId: id } }),
          db.content.delete({ where: { id } }),
        ]);
        return reply({ ok: true });
      }
    }
    if (area === "share" && id && req.method === "GET") {
      const s = await db.share.findUnique({ where: { tokenHash: hash(id) } });
      if (!s || s.revoked || (s.expiresAt && s.expiresAt <= new Date()))
        throw new HubError("SHARE", "링크가 만료되었거나 공유가 중단되었습니다.", 404);
      const c = await db.content.findUnique({ where: { id: s.contentId } });
      if (!c || c.visibility === "private")
        throw new HubError("SHARE", "공유가 중단되었습니다.", 404);
      return reply({ content: serialize(c, false) });
    }
    if (area === "run" && id && req.method === "POST") {
      const builtin = findBuiltin(id);
      const c = builtin ? undefined : await readable(req, id);
      if (c && c.kind !== "agent") throw new HubError("RUN", "에이전트만 실행할 수 있습니다.");
      await rateLimit(`run-ip:${hash(requestIp(req))}`, Number(process.env.RUN_IP_LIMIT) || 60);
      await rateLimit(`run-browser:${b.id}`, Number(process.env.RUN_SESSION_LIMIT) || 30);
      const data = runSchema.parse(await limitedBody(req));
      if (active >= 3)
        throw new HubError("BUSY", "다른 작업이 실행 중입니다. 잠시 후 다시 실행해 주세요.", 429);
      active++;
      const start = Date.now();
      try {
        const result = await runAgent(
          builtin?.id || "",
          (c ? JSON.parse(c.definition) : { type: builtin!.type }) as Definition,
          data,
        );
        await db.execution.create({
          data: {
            id: randomUUID(),
            browserId: b.id,
            contentId: id,
            status: result.status,
            durationMs: Date.now() - start,
          },
        });
        return reply({ result });
      } catch (e) {
        await db.execution.create({
          data: {
            id: randomUUID(),
            browserId: b.id,
            contentId: id,
            status: "failure",
            errorCode: e instanceof HubError ? e.code : "INTERNAL",
            durationMs: Date.now() - start,
          },
        });
        throw e;
      } finally {
        active--;
      }
    }
    if (area === "preview" && req.method === "POST") {
      await rateLimit(`run-ip:${hash(requestIp(req))}`, Number(process.env.RUN_IP_LIMIT) || 60);
      await rateLimit(`run-browser:${b.id}`, Number(process.env.RUN_SESSION_LIMIT) || 30);
      const raw = await limitedBody(req, 100_000);
      const { definition, input } = z
        .object({ definition: definitionSchema, input: z.string().max(60_000) })
        .parse(raw);
      if (active >= 3)
        throw new HubError("BUSY", "다른 작업이 실행 중입니다. 잠시 후 다시 실행해 주세요.", 429);
      active++;
      try {
        return reply({ result: await runAgent("", definition, { input }) });
      } finally {
        active--;
      }
    }
    if (area === "favorites") {
      if (req.method === "GET")
        return reply({
          favorites: (await db.favorite.findMany({ where: { browserId: b.id } })).map((f) => ({
            key: f.key,
            ...JSON.parse(f.data),
          })),
        });
      if (req.method === "POST") {
        const data = z
          .object({ key: z.string().max(200), data: z.record(z.string(), z.string().max(3000)) })
          .parse(await limitedBody(req, 16000));
        await db.favorite.upsert({
          where: { browserId_key: { browserId: b.id, key: data.key } },
          create: { browserId: b.id, key: data.key, data: JSON.stringify(data.data) },
          update: { data: JSON.stringify(data.data) },
        });
        return reply({ ok: true });
      }
      if (req.method === "DELETE" && id) {
        await db.favorite.deleteMany({ where: { browserId: b.id, key: id } });
        return reply({ ok: true });
      }
    }
    if (area === "progress") {
      if (req.method === "GET")
        return reply({
          progress: await db.progress.findMany({
            where: { browserId: b.id },
            select: { tutorial: true, step: true },
          }),
        });
      if (req.method === "POST") {
        const data = z
          .object({
            tutorial: z.enum(["first", "data", "create"]),
            step: z.number().int().min(0).max(4),
          })
          .parse(await limitedBody(req, 4096));
        await db.progress.upsert({
          where: { browserId_tutorial: { browserId: b.id, tutorial: data.tutorial } },
          create: { browserId: b.id, ...data },
          update: { step: data.step },
        });
        return reply({ ok: true });
      }
    }
    throw new HubError("NOT_FOUND", "요청을 찾을 수 없습니다.", 404);
  } catch (e) {
    if (e instanceof HubError) {
      const res = reply({ error: { code: e.code, message: e.message } }, e.status);
      if (e.status === 429) res.headers.set("Retry-After", "900");
      return res;
    }
    if (e instanceof z.ZodError)
      return reply(
        { error: { code: "VALIDATION", message: "입력 형식이나 길이를 확인해 주세요." } },
        400,
      );
    // Never log request bodies, provider errors, URLs, tokens, or file contents.
    console.error("Agent Hub request failed", e instanceof Error ? e.name : "Unknown");
    return reply(
      {
        error: {
          code: "INTERNAL",
          message: "처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
        },
      },
      500,
    );
  }
}
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
