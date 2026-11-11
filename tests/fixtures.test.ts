import test from "node:test";
import assert from "node:assert/strict";
import { readCaso } from "../src/domain/reader.js";
import { mapCampos } from "../src/domain/mapping.js";
import { buildChecklist } from "../src/domain/supports.js";

const directory = process.cwd();

test("clasifica los campos de los cuatro casos esperados", async () => {
  const expected = {
    "co-industrias-delta": [17, 0, 0],
    "ec-corp-andina": [13, 1, 1],
    "hn-agroexport-sula": [9, 1, 1],
    "pa-logistica-istmo": [8, 0, 1]
  } as const;
  for (const [caso, [llenos, faltantes, confirmations]] of Object.entries(expected)) {
    const data = await readCaso(directory, caso);
    const mapping = await mapCampos(directory, data.solicitud, data.campos);
    assert.equal(mapping.llenos.length, llenos, caso);
    assert.equal(mapping.faltantes.length, faltantes, caso);
    assert.equal(mapping.requiere_confirmacion.length, confirmations, caso);
  }
});

test("la fecha fija identifica los bloqueos de soportes", async () => {
  const expected = {
    "co-industrias-delta": ["camara_comercio: vencido"],
    "ec-corp-andina": ["camara_comercio: vencido", "certificado_cumplimiento_tributario: ausente"],
    "hn-agroexport-sula": ["camara_comercio: vencido", "parafiscales: vencido"],
    "pa-logistica-istmo": ["camara_comercio: vencido"]
  } as const;
  for (const [caso, blocks] of Object.entries(expected)) {
    const data = await readCaso(directory, caso);
    const checklist = await buildChecklist(directory, caso, data.soportes, "2026-11-10");
    assert.deepEqual(checklist.bloqueos, blocks, caso);
    assert.equal(checklist.listo_para_firma, false, caso);
  }
});