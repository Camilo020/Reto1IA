import type { Campo, Celda, Mapeo, MapeoCampo, Solicitud } from "./schemas.js";
import { isCell, readGlossary, readMaster } from "./reader.js";

function valueAt(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => {
    if (value && typeof value === "object" && !Array.isArray(value)) return (value as Record<string, unknown>)[key];
    return undefined;
  }, source);
}

function stringify(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function isForeignTaxIdentifier(label: string, country: string): boolean {
  const normalized = label.trim().toUpperCase();
  return (normalized === "RUC" && ["EC", "PE", "PA"].includes(country)) || (normalized === "RTN" && country === "HN");
}

function itemLabel(item: Celda | Campo): string {
  return item.etiqueta;
}

export async function mapCampos(directory: string, solicitud: Solicitud, campos: (Celda | Campo)[]): Promise<Mapeo> {
  const [glossary, master] = await Promise.all([readGlossary(directory), readMaster(directory)]);
  const all = campos.map((item, index): MapeoCampo => {
    const etiqueta = itemLabel(item);
    const ruta = glossary[etiqueta];
    const value = ruta ? stringify(valueAt(master, ruta)) : null;
    const base = {
      id: `${index + 1}:${etiqueta}`,
      etiqueta,
      ruta_maestro: ruta ?? null,
      valor: value,
      obligatorio: "obligatorio" in item ? item.obligatorio : undefined,
      hoja: isCell(item) ? item.hoja : undefined,
      celda_etiqueta: isCell(item) ? item.celda_etiqueta : undefined,
      celda_valor: isCell(item) ? item.celda_valor : undefined,
      orden: index
    };
    if (!ruta || value === null) return { ...base, estado: "faltante", confianza: 0, motivo: "No existe una fuente verificable en el maestro" };
    if (isForeignTaxIdentifier(etiqueta, solicitud.pais)) {
      return { ...base, estado: "requiere_confirmacion", confianza: 1, motivo: "identificador extranjero", contexto: "Periferia solo dispone de NIT colombiano" };
    }
    if (ruta === "ingresos_ultimo_ano.valor") {
      const income = valueAt(master, "ingresos_ultimo_ano") as Record<string, unknown>;
      return { ...base, estado: "lleno", confianza: 1, motivo: null, contexto: `${String(income.moneda)} · ${String(income.ano)}` };
    }
    return { ...base, estado: "lleno", confianza: 1, motivo: null };
  });
  return {
    llenos: all.filter((item) => item.estado === "lleno"),
    faltantes: all.filter((item) => item.estado === "faltante"),
    requiere_confirmacion: all.filter((item) => item.estado === "requiere_confirmacion")
  };
}

export function allMappings(mapeo: Mapeo): MapeoCampo[] {
  return [...mapeo.llenos, ...mapeo.faltantes, ...mapeo.requiere_confirmacion].sort((a, b) => a.orden - b.orden);
}
