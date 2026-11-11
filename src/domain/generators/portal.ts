import type { Campo, Mapeo, Solicitud } from "../schemas.js";
import { allMappings } from "../mapping.js";

export function buildPortalMarkdown(solicitud: Solicitud, campos: Campo[], mapeo: Mapeo): string {
  const values = allMappings(mapeo);
  const lines = [
    `# Valores para el portal de ${solicitud.cliente}`,
    "",
    "Formato no soportado: este archivo contiene valores para copiar manualmente. No se accedió al portal ni se enviaron datos.",
    "",
    "| Campo | Valor propuesto | Estado | Fuente / advertencia |",
    "|---|---|---|---|"
  ];
  campos.forEach((campo, index) => {
    const field = values[index];
    const value = field?.valor ?? "PENDIENTE";
    const note = field?.motivo ?? field?.ruta_maestro ?? "sin fuente";
    lines.push(`| ${escapeTable(campo.etiqueta)} | ${escapeTable(value)} | ${field?.estado ?? "faltante"} | ${escapeTable(note)} |`);
  });
  lines.push("", "La carga, las credenciales y el clic final de envío son responsabilidad humana.", "");
  return lines.join("\n");
}

function escapeTable(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}