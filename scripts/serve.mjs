import http from "node:http";
import next from "next";
import { networkInterfaces } from "node:os";
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const port = Number(option("--port", args.find((a) => /^\d+$/.test(a)) || "5000"));
const hostname = option("--hostname", "0.0.0.0");
// Only this HTTP entrypoint supplies the socket-derived IP header.
// Incoming values are always replaced, so clients cannot spoof it.
process.env.HUB_SOCKET_IP = "1";
const app = next({ dev: false, hostname, port });
await app.prepare();
const handle = app.getRequestHandler();
const server = http.createServer((req, res) => {
  const forwarded = process.env.TRUST_PROXY === "1" ? req.headers["x-forwarded-for"] : undefined;
  const ip =
    typeof forwarded === "string"
      ? forwarded.split(",")[0].trim()
      : req.socket.remoteAddress || "unknown";
  req.headers["x-hub-client-ip"] = ip;
  if (process.env.TRUST_PROXY !== "1") {
    delete req.headers["x-forwarded-for"];
    delete req.headers["x-forwarded-host"];
    delete req.headers["x-forwarded-proto"];
  }
  void handle(req, res);
});
server.requestTimeout = 45000;
server.headersTimeout = 15000;
server.on("error", (error) => {
  console.error(
    error.code === "EADDRINUSE"
      ? `${port}번 포트가 사용 중입니다. 기존 서버를 종료한 후 다시 실행하세요.`
      : error.message,
  );
  process.exit(1);
});
server.listen(port, hostname, () => {
  console.log(`Agent Hub listening on ${hostname}:${port}`);
  if (hostname === "0.0.0.0") {
    console.log(`내 컴퓨터: http://localhost:${port}`);
    const addresses = [
      ...new Set(
        Object.values(networkInterfaces())
          .flat()
          .filter((item) => item?.family === "IPv4" && !item.internal)
          .map((item) => item.address),
      ),
    ];
    for (const address of addresses)
      console.log(`같은 네트워크에서 공유: http://${address}:${port}`);
    console.log("다른 기기도 같은 Wi-Fi/사내망에 연결되어 있어야 합니다. Ctrl+C로 종료합니다.");
  }
});
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    server.close(async () => {
      await app.close();
      process.exit(0);
    });
    server.closeIdleConnections();
    setTimeout(() => process.exit(0), 5000).unref();
  });
