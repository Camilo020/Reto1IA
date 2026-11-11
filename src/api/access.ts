import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

export class AccessGate {
  private readonly tickets = new Map<string, number>();

  constructor(private readonly secret?: string) {}

  authorize(req: IncomingMessage): boolean {
    if (!this.secret) return true;
    const cookie = (req.headers.cookie ?? "").split(";").map((part) => part.trim()).find((part) => part.startsWith("access="));
    const ticket = cookie?.slice("access=".length);
    return Boolean(ticket && (this.tickets.get(ticket) ?? 0) > Date.now());
  }

  login(req: IncomingMessage, res: ServerResponse): boolean {
    if (!this.secret) return true;
    const header = req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
    const first = Buffer.from(createHash("sha256").update(header).digest());
    const second = Buffer.from(createHash("sha256").update(this.secret).digest());
    if (!timingSafeEqual(first, second)) return false;
    const ticket = randomBytes(32).toString("hex");
    this.tickets.set(ticket, Date.now() + 8 * 60 * 60 * 1000);
    res.setHeader("set-cookie", `access=${ticket}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);
    return true;
  }
}