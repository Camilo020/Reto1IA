import { copyFileAtomic, ensureDir, writeFileAtomic } from "../infra/files.js";
import { prepareOutput, safeOutputChild } from "../infra/paths.js";
import { allMappings } from "./mapping.js";
import { buildChecklist, type Checklist } from "./supports.js";
import { generateForm } from "./generators/index.js";
import type { Caso, Mapeo, ToolContext } from "./schemas.js";

export type Paquete = { ruta: string; listo_para_firma: boolean; checklist: Checklist; formulario: string; avisos: string[] };

export async function buildPackage(payloadCaso: Caso, mapeo: Mapeo, ctx: ToolContext, today: string): Promise<Paquete> {
  const caso = payloadCaso.solicitud.id;
  const dir = await prepareOutput(ctx.directory, caso);
  const paqueteDir = await safeOutputChild(ctx.directory, caso, "paquete");
  await ensureDir(paqueteDir);
  const generated = await generateForm(payloadCaso, mapeo, ctx);
  const formularioName = generated.formato === "portal" ? "valores-portal.md" : `formulario.${generated.formato}`;
  await copyFileAtomic(`${dir}/${formularioName}`, `${paqueteDir}/${formularioName}`);

  const checklist = await buildChecklist(ctx.directory, caso, payloadCaso.soportes, today);
  const avisos: string[] = [];
  for (const item of checklist.items) {
    if (item.estado === "presente" && item.path) await copyFileAtomic(item.path, `${paqueteDir}/soportes/${item.archivo}`);
    if (item.estado === "vencido" && item.path) {
      await copyFileAtomic(item.path, `${paqueteDir}/soportes/${item.archivo}`);
      avisos.push(`Soporte vencido incluido marcado: ${item.tipo} (${item.vigencia_hasta})`);
    }
    if (item.estado === "ausente") avisos.push(`Soporte ausente: ${item.tipo}`);
    if (item.estado === "sin_vigencia_informada") avisos.push(`Soporte sin vigencia informada: ${item.tipo}`);
  }

  const mappings = allMappings(mapeo);
  const faltantes = mappings.filter((item) => item.estado === "faltante");
  const pendientes = mappings.filter((item) => item.estado === "requiere_confirmacion");
  if (faltantes.length) avisos.push(`Campos faltantes (no bloquean firma): ${faltantes.map((item) => item.etiqueta).join(", ")}`);
  if (pendientes.length) avisos.push(`Campos por confirmar: ${pendientes.map((item) => item.etiqueta).join(", ")}`);
  if (generated.formato === "portal") avisos.push("Formato portal: no se automatiza el sitio; se entrega Markdown copiable");

  await writeFileAtomic(`${paqueteDir}/checklist.md`, renderChecklist(caso, checklist, avisos));
  await writeFileAtomic(`${paqueteDir}/borrador-correo.md`, renderDraft(payloadCaso, checklist));
  return { ruta: `out/${caso}/paquete`, listo_para_firma: checklist.listo_para_firma, checklist, formulario: formularioName, avisos };
}

function renderChecklist(caso: string, checklist: Checklist, avisos: string[]): string {
  const rows = checklist.items.map((item) => `| ${item.tipo} | ${item.estado} | ${item.vigencia_hasta ?? "sin dato"} | ${item.pais_emisor ?? "-"} | ${item.advertencia ?? ""} |`);
  return [
    `# Checklist de soportes — ${caso}`,
    "",
    `Fecha de ejecución: ${checklist.hoy}`,
    "",
    "| Soporte | Estado | Vigencia hasta | Emisor | Advertencia |",
    "|---|---|---|---|---|",
    ...rows,
    "",
    `**listo_para_firma:** ${checklist.listo_para_firma ? "sí" : "no"}`,
    checklist.listo_para_firma ? "" : `Bloqueos: ${checklist.bloqueos.join("; ")}`,
    "",
    "> Este indicador evalúa los soportes exigidos por el cliente. No garantiza la completitud jurídica del formulario ni la aceptación de documentos emitidos en otro país.",
    "",
    "## Avisos",
    ...avisos.map((item) => `- ${item}`)
  ].join("\n");
}

function renderDraft(payloadCaso: Caso, checklist: Checklist): string {
  const { solicitud } = payloadCaso;
  const missing = checklist.items.filter((item) => item.estado !== "presente");
  return [
    `# Borrador de correo — ${solicitud.cliente}`,
    "",
    `Para: ${solicitud.de}`,
    `Asunto: Registro como proveedor — Periferia IT Group S.A.S.`,
    "",
    "Estimado equipo,",
    "",
    `Adjuntamos la documentación para el registro de Periferia IT Group S.A.S. como proveedor.`,
    "",
    `Formato solicitado: ${solicitud.formato}.`,
    missing.length ? `Soportes pendientes o por revisar: ${missing.map((item) => item.tipo).join(", ")}.` : "Soportes exigidos adjuntos.",
    "",
    "Quedamos atentos a cualquier ajuste.",
    "",
    "Atentamente,",
    "Periferia IT Group S.A.S.",
    "",
    "> Borrador generado por el agente. No se envían datos bancarios y no se ha enviado nada."
  ].join("\n");
}