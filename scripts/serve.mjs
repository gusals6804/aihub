import http from "node:http";
import next from "next";
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const port = Number(option("--port", args.find((a) => /^\d+$/.test(a)) || "3000"));
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
server.listen(port, hostname, () => console.log(`Agent Hub listening on ${hostname}:${port}`));
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
