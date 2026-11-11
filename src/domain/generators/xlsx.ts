import ExcelJS from "exceljs";
import type { Celda, Mapeo } from "../schemas.js";
import { allMappings } from "../mapping.js";

export async function buildXlsx(celdas: Celda[], mapeo: Mapeo): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheets = new Map<string, ExcelJS.Worksheet>();
  const mappings = new Map(allMappings(mapeo).map((item) => [`${item.hoja}:${item.celda_valor}`, item]));
  for (const celda of celdas) {
    let sheet = sheets.get(celda.hoja);
    if (!sheet) {
      sheet = workbook.addWorksheet(celda.hoja);
      sheets.set(celda.hoja, sheet);
    }
    const mapping = mappings.get(`${celda.hoja}:${celda.celda_valor}`);
    sheet.getCell(celda.celda_etiqueta).value = celda.etiqueta;
    const value = mapping && mapping.valor !== null ? mapping.valor : "";
    const cell = sheet.getCell(celda.celda_valor);
    cell.value = value;
    cell.numFmt = "@";
    if (mapping?.estado === "faltante") cell.value = "PENDIENTE: no existe en el maestro";
    if (mapping?.estado === "requiere_confirmacion") cell.value = `${value} (por confirmar: ${mapping.motivo ?? "requiere_confirmación"})`;
  }
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}