import test from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/server.js";

const directory = process.cwd();

async function withServer(fn: (base: string) => Promise<void>): Promise<void> {
  const server = await createApp(directory);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test("health no expone secretos y chat responde sin clave", async () => {
  await withServer(async (base) => {
    const health = (await (await fetch(`${base}/api/health`)).json()) as { ok: boolean; provider: string; model: string };
    assert.equal(health.ok, true);
    assert.equal(JSON.stringify(health).includes("key"), false);
    const chat = (await (await fetch(`${base}/api/chat`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "api-1", message: "hola" })
    })).json()) as { ok: boolean; reply: string };
    assert.equal(chat.ok, true);
    assert.equal(typeof chat.reply, "string");
  });
});

test("con ACCESS_TOKEN la API exige autenticación y entrega cookie", async () => {
  process.env.ACCESS_TOKEN = "clave-de-prueba";
  delete process.env.DEEPSEEK_API_KEY;
  try {
    const server = await createApp(directory);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${port}`;
    const denied = await fetch(`${base}/api/health`);
    assert.equal(denied.status, 401);
    const login = await fetch(`${base}/api/access`, { method: "POST", headers: { authorization: "Bearer clave-de-prueba" } });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie") ?? "";
    assert.match(cookie, /access=/);
    const allowed = await fetch(`${base}/api/health`, { headers: { cookie: cookie.split(";")[0] ?? "" } });
    assert.equal(allowed.status, 200);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  } finally {
    delete process.env.ACCESS_TOKEN;
  }
});

test("la descarga rechaza traversal y sirve un archivo real", async () => {
  await withServer(async (base) => {
    const blocked = await fetch(`${base}/api/files/co-industrias-delta/..%2F..%2Fpackage.json`);
    assert.notEqual(blocked.status, 200);
    const req = await fetch(`${base}/api/chat`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "api-2", message: "hola" })
    });
    void req;
    const ok = await fetch(`${base}/api/files/co-industrias-delta/formulario.xlsx`);
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get("content-type"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  });
});