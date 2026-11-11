import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Campo, Mapeo } from "../schemas.js";
import { allMappings } from "../mapping.js";

const margin = 54;
const lineHeight = 19;

export async function buildPdf(campos: Campo[], mapeo: Mapeo): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const mappings = allMappings(mapeo);
  let page = document.addPage([612, 792]);
  let y = 738;
  page.drawText("Formulario de registro como proveedor", { x: margin, y, size: 16, font: bold });
  y -= 36;
  for (let index = 0; index < campos.length; index += 1) {
    if (y < 80) {
      page = document.addPage([612, 792]);
      y = 738;
    }
    const field = campos[index];
    const mapping = mappings[index];
    const label = `${field?.etiqueta ?? "Campo"}${field?.obligatorio ? " *" : ""}`;
    const value = mapping?.valor ?? "PENDIENTE: no existe en el maestro";
    const suffix = mapping?.estado === "requiere_confirmacion" ? " [REQUIERE CONFIRMACIÓN]" : "";
    page.drawText(label, { x: margin, y, size: 10, font: bold });
    y -= 14;
    page.drawText(`${value}${suffix}`.slice(0, 96), { x: margin + 10, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
    y -= lineHeight;
  }
  return document.save();
}