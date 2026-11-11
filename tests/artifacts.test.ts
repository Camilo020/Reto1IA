import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import { readCaso, isCell } from "../src/domain/reader.js";
import { mapCampos } from "../src/domain/mapping.js";
import { buildXlsx } from "../src/domain/generators/xlsx.js";
import { buildPdf } from "../src/domain/generators/pdf.js";
import { buildPortalMarkdown } from "../src/domain/generators/portal.js";
import type { Campo } from "../src/domain/schemas.js";

const directory = process.cwd();

test("Excel conserva ubicaciones y números como texto", async () => {
  const data = await readCaso(directory, "co-industrias-delta");
  const map = await mapCampos(directory, data.solicitud, data.campos);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await buildXlsx(data.campos.filter(isCell), map) as unknown as Parameters<typeof book.xlsx.load>[0]);
  assert.equal(book.getWorksheet("Datos Proveedor")?.getCell("B4").value, "NIT");
  assert.equal(book.getWorksheet("Datos Proveedor")?.getCell("C4").value, "900123456");
  assert.equal(book.getWorksheet("Datos Proveedor")?.getCell("C8").value, "050021");
  assert.equal(book.getWorksheet("Datos Bancarios")?.getCell("C5").value, "03100012345");
});

test("PDF genera páginas y el caso ECU produce artefacto legible", async () => {
  const data = await readCaso(directory, "ec-corp-andina");
  const map = await mapCampos(directory, data.solicitud, data.campos);
  const pdf = await buildPdf(data.campos as Campo[], map);
  const doc = await PDFDocument.load(pdf);
  assert.ok(doc.getPageCount() > 0);
  const original = await readFile(`${directory}/out/ec-corp-andina/formulario.pdf`);
  assert.ok(original.byteLength > 1000);
});

test("portal entrega nueve filas y marca RUC pendiente", async () => {
  const data = await readCaso(directory, "pa-logistica-istmo");
  const map = await mapCampos(directory, data.solicitud, data.campos);
  const markdown = buildPortalMarkdown(data.solicitud, data.campos as Campo[], map);
  assert.match(markdown, /formato no soportado/i);
  assert.match(markdown, /RUC \| 900123456 \| requiere_confirmacion/);
  assert.equal(markdown.split("\n").filter((line) => line.startsWith("| ")).length, 10);
});