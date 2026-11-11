import { createServer, type Server } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { loadConfig, loadPrompt } from "./config.js";
import { DeepSeekAdapter } from "./llm/deepseek.js";
import { FakeAdapter } from "./llm/fake.js";
import { toolSpecs } from "./tools/registry.js";
import { Sessions } from "./agent/session.js";
import { runTurn } from "./agent/loop.js";
import { chat, health, sessions as sessionsRoute, send, type ApiContext } from "./api/routes.js";
import { AccessGate } from "./api/access.js";
import { outputRoot, validateCaso } from "./infra/paths.js";

const staticFiles = new Map<string, string>([
  ["/", "index.html"], ["/index.html", "index.html"], ["/styles.css", "styles.css"], ["/app.js", "app.js"]
]);

export async function createApp(directory: string): Promise<Server> {
  const config = loadConfig();
  const adapter = config.LLM_PROVIDER === "fake" ? new FakeAdapter() : config.DEEPSEEK_API_KEY
    ? new DeepSeekAdapter({ apiKey: config.DEEPSEEK_API_KEY, baseUrl: config.DEEPSEEK_BASE_URL, model: config.DEEPSEEK_MODEL, timeoutMs: config.LLM_TIMEOUT_MS })
    : new FakeAdapter();
  const prompt = await loadPrompt(directory);
  const sessions = new Sessions();
  const ctx: ApiContext = { sessions, provider: adapter.provider, model: adapter.model };
  const gate = new AccessGate(config.ACCESS_TOKEN);
  const hits = new Map<string, { count: number; reset: number }>();
  const webRoot = path.join(directory, "web");

  return createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (req.method === "POST" && url.pathname === "/api/access") {
        const granted = gate.login(req, res);
        return send(res, granted ? 200 : 401, { ok: granted });
      }
      const isStatic = req.method === "GET" && staticFiles.has(url.pathname);
      if (!isStatic && !gate.authorize(req)) return send(res, 401, { ok: false, error: "Acceso protegido" });
      if (req.method === "GET" && url.pathname === "/api/health") return health(ctx, res);
      if (req.method === "GET" && url.pathname.startsWith("/api/sessions/")) return sessionsRoute(ctx, req, url.pathname.split("/").pop() ?? "", res);
      if (req.method === "POST" && url.pathname === "/api/chat") {
        if (!allow(hits, req.socket.remoteAddress ?? "anon", config.RATE_LIMIT_PER_MINUTE)) return send(res, 429, { ok: false, error: "Demasiadas solicitudes" });
        return chat(ctx, req, res, async (sessionId, message) => {
          const session = sessions.get(sessionId, config.MAX_TOKENS_PER_SESSION);
          const result = await runTurn(session, message, {
            adapter, specs: toolSpecs, maxIterations: config.MAX_ITERATIONS_PER_TURN,
            context: { directory, sessionId }, prompt
          });
          return { reply: result.reply, toolCalls: result.toolCalls, needsConfirmation: result.needsConfirmation };
        });
      }
      if (req.method === "GET" && url.pathname.startsWith("/api/files/")) {
        const [, , , caso, ...fileParts] = url.pathname.split("/");
        if (!caso || !fileParts.length) return send(res, 400, { ok: false, error: "Ruta inválida" });
        validateCaso(caso);
        if (fileParts.some((part) => !part || part === "." || part === ".." || part.includes("\\"))) return send(res, 400, { ok: false, error: "Ruta inválida" });
        const source = path.join(outputRoot(directory), caso, ...fileParts);
        const actual = await realpath(source).catch(() => null);
        const base = await realpath(path.join(outputRoot(directory), caso)).catch(() => null);
        if (!actual || !base || !actual.startsWith(base + path.sep) || !(await stat(actual)).isFile()) return send(res, 404, { ok: false, error: "Archivo no encontrado" });
        const body = await readFile(actual);
        res.writeHead(200, { "content-type": contentType(actual), "content-disposition": `attachment; filename="${path.basename(actual)}"`, "cache-control": "no-store", "x-content-type-options": "nosniff" });
        res.end(body);
        return;
      }
      if (req.method === "GET") {
        const name = staticFiles.get(url.pathname);
        if (name) {
          const body = await readFile(path.join(webRoot, name));
          res.writeHead(200, { "content-type": contentType(name), "cache-control": "no-store", "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'", "x-content-type-options": "nosniff" });
          res.end(body);
          return;
        }
      }
      send(res, 404, { ok: false, error: "No encontrado" });
    })().catch(() => send(res, 500, { ok: false, error: "Error interno" }));
  });
}

function contentType(file: string): string {
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".pdf")) return "application/pdf";
  if (file.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "text/plain; charset=utf-8";
}

function allow(hits: Map<string, { count: number; reset: number }>, key: string, limit: number): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.reset < now) { hits.set(key, { count: 1, reset: now + 60000 }); return true; }
  entry.count += 1;
  return entry.count <= limit;
}

export async function startServer(directory: string): Promise<Server> {
  const server = await createApp(directory);
  const port = loadConfig().PORT;
  await new Promise<void>((resolve) => server.listen(port, "0.0.0.0", resolve));
  console.log(`registro-proveedor local en puerto ${port}`);
  return server;
}

if (process.argv[1] && (process.argv[1].endsWith("server.ts") || process.argv[1].endsWith("server.js"))) {
  await startServer(process.cwd());
}