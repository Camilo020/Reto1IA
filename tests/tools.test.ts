import test from "node:test";
import assert from "node:assert/strict";
import { leer_solicitud, mapear_campos, generar_formulario, simular_envio } from "../src/tools/proveedor.js";

const ctx = { directory: process.cwd(), sessionId: "test", today: "2026-11-10" };

test("las herramientas retornan JSON y generan XLSX", async () => {
  const read = JSON.parse(await leer_solicitud.execute({ caso: "co-industrias-delta" }, ctx)) as { ok: boolean; data: { campos: { etiqueta: string }[] } };
  assert.equal(read.ok, true);
  const map = JSON.parse(await mapear_campos.execute({ caso: "co-industrias-delta", campos: read.data.campos }, ctx)) as { ok: boolean; data: unknown };
  assert.equal(map.ok, true);
  const generated = JSON.parse(await generar_formulario.execute({ caso: "co-industrias-delta", mapeo: map.data as never }, ctx)) as { ok: boolean; data: { ruta: string } };
  assert.equal(generated.ok, true);
  assert.equal(generated.data.ruta, "out/co-industrias-delta/formulario.xlsx");
});

test("la simulación de envío exige autorización de contexto", async () => {
  const denied = JSON.parse(await simular_envio.execute({ caso: "ec-corp-andina", confirmado: true }, ctx)) as { ok: boolean; error: string };
  assert.equal(denied.ok, false);
  assert.equal(denied.error, "requiere confirmación explícita");
  const allowed = JSON.parse(await simular_envio.execute({ caso: "ec-corp-andina", confirmado: true }, { ...ctx, authorizedCase: "ec-corp-andina" })) as { ok: boolean; data: { ruta: string } };
  assert.equal(allowed.ok, true);
  assert.equal(allowed.data.ruta, "out/ec-corp-andina/ENVIO-SIMULADO.md");
});