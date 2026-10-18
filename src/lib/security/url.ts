import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import https from "node:https";
import { HubError } from "./access";
export function publicIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0)) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a === 198 ||
      (a === 203 && b === 0)
    );
  }
  return (
    isIP(ip) === 6 &&
    /^[23][0-9a-f]{3}:/i.test(ip) &&
    !/^2001:(db8|0:|10:|20:)/i.test(ip) &&
    !/^2002:/i.test(ip)
  );
}
export async function safeUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HubError("URL", "올바른 HTTPS 주소를 입력해 주세요.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    url.hostname.endsWith(".") ||
    url.hostname === "localhost"
  )
    throw new HubError("URL", "공개 HTTPS 웹사이트만 등록할 수 있습니다.");
  let addresses;
  try {
    addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ""), { all: true });
  } catch {
    throw new HubError(
      "URL",
      "웹사이트 DNS를 확인할 수 없습니다. 서버 네트워크·DNS 설정을 확인해 주세요.",
    );
  }
  if (!addresses.length || addresses.some((a) => !publicIp(a.address)))
    throw new HubError("SSRF", "내부망·로컬 주소에는 접근할 수 없습니다.");
  return { url, address: addresses[0] };
}
// Pin the validated DNS answer for the connection; validate each redirect again.
export async function publicText(raw: string, redirects = 0): Promise<string> {
  if (redirects > 3) throw new HubError("URL", "리디렉션이 너무 많습니다.");
  const { url, address } = await safeUrl(raw);
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        timeout: 12_000,
        family: address.family,
        lookup: (_host, _opts, cb) => cb(null, address.address, address.family),
      },
      (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          res.resume();
          publicText(new URL(res.headers.location, url).href, redirects + 1).then(resolve, reject);
          return;
        }
        if (
          res.statusCode !== 200 ||
          !/text\/(html|plain)/.test(res.headers["content-type"] || "")
        ) {
          res.resume();
          reject(new HubError("FETCH", "공개 텍스트 문서를 가져올 수 없습니다."));
          return;
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        res.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 1_000_000) {
            req.destroy();
            reject(new HubError("BODY_SIZE", "문서가 너무 큽니다."));
          } else chunks.push(chunk);
        });
        res.on("end", () =>
          resolve(
            Buffer.concat(chunks)
              .toString("utf8")
              .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "")
              .replace(/<[^>]+>/g, " ")
              .slice(0, 60_000),
          ),
        );
        res.on("error", () => reject(new HubError("FETCH", "문서를 읽을 수 없습니다.")));
      },
    );
    const deadline = setTimeout(() => req.destroy(new Error("deadline")), 12_000);
    req.on("close", () => clearTimeout(deadline));
    req.on("timeout", () => req.destroy());
    req.on("error", () =>
      reject(new HubError("FETCH", "문서 조회 시간이 초과되었거나 접근이 제한되었습니다.")),
    );
  });
}
