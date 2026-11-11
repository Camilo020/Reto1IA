import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { chatRequestSchema } from "../agent/presentation.js";
import type { Session } from "../agent/session.js";

export type ApiContext = {
  sessions: { find: (id: string) => Session | undefined };
  provider: string;
  model: string;
  accessToken?: string;
};

export function authorized(req: IncomingMessage, expected?: string): boolean {
  if (!expected) return true;
  const supplied = req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function send(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(payload));
}

export async function health(ctx: ApiContext, res: ServerResponse): Promise<void> {
  send(res, 200, { ok: true, provider: ctx.provider, model: ctx.model });
}

export async function sessions(ctx: ApiContext, req: IncomingMessage, id: string, res: ServerResponse): Promise<void> {
  if (!authorized(req, ctx.accessToken)) return send(res, 401, { ok: false, error: "No autorizado" });
  const session = ctx.sessions.find(id);
  if (!session) return send(res, 404, { ok: false, error: "Sesión no encontrada" });
  send(res, 200, { ok: true, history: session.history });
}

export async function chat(
  ctx: ApiContext,
  req: IncomingMessage,
  res: ServerResponse,
  run: (sessionId: string, message: string) => Promise<unknown>
): Promise<void> {
  if (!authorized(req, ctx.accessToken)) return send(res, 401, { ok: false, error: "No autorizado" });
  let body: unknown;
  try {
    body = await readBody(req);
  } catch {
    return send(res, 413, { ok: false, error: "Cuerpo demasiado grande" });
  }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) return send(res, 400, { ok: false, error: "Solicitud inválida" });
  try {
    const result = await run(parsed.data.sessionId, parsed.data.message);
    send(res, 200, { ok: true, ...(typeof result === "object" && result ? result : { reply: String(result) }) });
  } catch {
    send(res, 500, { ok: false, error: "No se pudo completar la solicitud" });
  }
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    size += buffer.length;
    if (size > 64 * 1024) throw new Error("Cuerpo demasiado grande");
    chunks.push(buffer);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    return null;
  }
}