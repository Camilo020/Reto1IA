import { writeFileAtomic } from "../../infra/files.js";
import { prepareOutput } from "../../infra/paths.js";
import type { Caso, Campo, Mapeo, ToolContext } from "../schemas.js";
import { isCell } from "../reader.js";
import { allMappings } from "../mapping.js";
import { buildXlsx } from "./xlsx.js";
import { buildPdf } from "./pdf.js";
import { buildPortalMarkdown } from "./portal.js";

export type Generated = { ruta: string; formato: string; aviso?: string };

export async function generateForm(payloadCaso: Caso, mapeo: Mapeo, ctx: ToolContext): Promise<Generated> {
  const dir = await prepareOutput(ctx.directory, payloadCaso.solicitud.id);
  const mappings = allMappings(mapeo);
  const expected = payloadCaso.campos.map((_, index) => index);
  for (const index of expected) {
    if (!mappings[index]) throw new Error("El mapeo no cubre todos los campos del descriptor");
  }
  const rel = (file: string): string => file.slice(ctx.directory.length + 1).replaceAll("\\", "/");
  if (payloadCaso.solicitud.formato === "xlsx") {
    const celdas = payloadCaso.campos.filter(isCell);
    const file = `${dir}/formulario.xlsx`;
    await writeFileAtomic(file, await buildXlsx(celdas, mapeo));
    return { ruta: rel(file), formato: "xlsx" };
  }
  if (payloadCaso.solicitud.formato === "pdf") {
    const campos = payloadCaso.campos.filter((item): item is Campo => !isCell(item));
    const file = `${dir}/formulario.pdf`;
    await writeFileAtomic(file, await buildPdf(campos, mapeo));
    return { ruta: rel(file), formato: "pdf" };
  }
  const campos = payloadCaso.campos.filter((item): item is Campo => !isCell(item));
  const file = `${dir}/valores-portal.md`;
  await writeFileAtomic(file, buildPortalMarkdown(payloadCaso.solicitud, campos, mapeo));
  return { ruta: rel(file), formato: "portal", aviso: "formato no soportado: valores listos para copiar" };
}