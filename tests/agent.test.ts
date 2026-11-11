import test from "node:test";
import assert from "node:assert/strict";
import { Sessions } from "../src/agent/session.js";
import { runTurn } from "../src/agent/loop.js";
import { toolSpecs } from "../src/tools/registry.js";
import type { LlmAdapter, LlmMessage, LlmResponse, LlmToolDefinition } from "../src/llm/adapter.js";
import { readFile, rm } from "node:fs/promises";

const directory = process.cwd();

class ScriptedAdapter implements LlmAdapter {
  readonly provider = "fake";
  readonly model = "scripted";
  private index = 0;
  constructor(private readonly script: LlmResponse[]) {}
  async send(_messages: LlmMessage[], _tools: LlmToolDefinition[]): Promise<LlmResponse> {
    const next = this.script[this.index++];
    return next ?? { content: "fin", toolCalls: [], usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } };
  }
}

function call(id: string, name: string, args: unknown): LlmResponse {
  return { content: "", toolCalls: [{ id, name, arguments: JSON.stringify(args) }], usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 } };
}

test("recorre lectura, mapeo y paquete, y exige confirmación para el envío", async () => {
  const read = JSON.parse(await import("../src/tools/proveedor.js").then((m) => m.leer_solicitud.execute({ caso: "ec-corp-andina" }, { directory, sessionId: "s" }))) as { data: { campos: unknown } };
  const sessions = new Sessions();
  const adapter = new ScriptedAdapter([
    call("t1", "proveedor_leer_solicitud", { caso: "ec-corp-andina" }),
    call("t2", "proveedor_mapear_campos", { caso: "ec-corp-andina", campos: read.data.campos }),
    call("t3", "proveedor_armar_paquete", { caso: "ec-corp-andina" }),
    { content: "El paquete no está listo para firma. ¿Confirmas que prepare el envío simulado para ec-corp-andina?", toolCalls: [], usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 } },
    call("t4", "proveedor_simular_envio", { caso: "ec-corp-andina", confirmado: true }),
    { content: "Listo.", toolCalls: [], usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } }
  ]);
  const session = sessions.get("s", 100000);
  const first = await runTurn(session, "Procesa el caso ec-corp-andina", { adapter, specs: toolSpecs, maxIterations: 10, context: { directory, sessionId: "s", today: "2026-11-10" }, prompt: "test" });
  assert.equal(first.needsConfirmation, true);
  assert.equal(session.state.pendingCase, "ec-corp-andina");
  const denied = await runTurn(session, "No confirmo el envío", { adapter, specs: toolSpecs, maxIterations: 10, context: { directory, sessionId: "s", today: "2026-11-10" }, prompt: "test" });
  assert.equal(JSON.stringify(denied.toolCalls).includes("ENVIO-SIMULADO"), false);
  assert.equal(session.state.pendingCase, null);

  const yes = await runTurn(sessions.get("s2", 100000), "Procesa el caso ec-corp-andina", {
    adapter: new ScriptedAdapter([call("a1", "proveedor_armar_paquete", { caso: "ec-corp-andina" }), { content: "¿Confirmas el envío simulado para ec-corp-andina?", toolCalls: [], usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } }]),
    specs: toolSpecs, maxIterations: 5, context: { directory, sessionId: "s2", today: "2026-11-10" }, prompt: "test"
  });
  assert.equal(yes.needsConfirmation, true);

  const enforce = new ScriptedAdapter([call("b1", "proveedor_simular_envio", { caso: "ec-corp-andina", confirmado: true }), { content: "hecho", toolCalls: [], usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } }]);
  const sent = await runTurn(sessions.get("s2", 100000), "sí, autorizo", { adapter: enforce, specs: toolSpecs, maxIterations: 5, context: { directory, sessionId: "s2", today: "2026-11-10" }, prompt: "test" });
  assert.match(JSON.stringify(sent.toolCalls), /ENVIO-SIMULADO/);
  assert.equal(sessions.get("s2", 100000).state.pendingCase, null);

  const again = await runTurn(sessions.get("s2", 100000), "sí, autorizo", { adapter: new ScriptedAdapter([call("c1", "proveedor_simular_envio", { caso: "ec-corp-andina", confirmado: true }), { content: "hecho", toolCalls: [], usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } }]), specs: toolSpecs, maxIterations: 5, context: { directory, sessionId: "s2", today: "2026-11-10" }, prompt: "test" });
  assert.match(JSON.stringify(again.toolCalls), /requiere confirmación explícita/);
});

test("un caso inexistente devuelve error legible sin romper la sesión", async () => {
  const { leer_solicitud } = await import("../src/tools/proveedor.js");
  const result = JSON.parse(await leer_solicitud.execute({ caso: "zz-no-existe" }, { directory, sessionId: "s" })) as { ok: boolean; error: string };
  assert.equal(result.ok, false);
  assert.match(result.error, /inexistente|no accesible|inválido/i);
});

test("la ruta con intento de traversal es rechazada", async () => {
  const { leer_solicitud } = await import("../src/tools/proveedor.js");
  const result = JSON.parse(await leer_solicitud.execute({ caso: "../../etc" }, { directory, sessionId: "s" })) as { ok: boolean };
  assert.equal(result.ok, false);
  await rm(`${directory}/out/tmp`, { recursive: true, force: true });
  const file = await readFile(`${directory}/package.json`, "utf8");
  assert.ok(file.includes("registro-proveedor-agent"));
});