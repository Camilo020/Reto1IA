import { caseDir, safeExisting } from "../infra/paths.js";
import { isExpired } from "./clock.js";
import { readSupportIndex } from "./reader.js";
import { lstat } from "node:fs/promises";
import path from "node:path";

export type SoporteEstado = "presente" | "ausente" | "vencido" | "sin_vigencia_informada";

export type ChecklistItem = {
  tipo: string;
  estado: SoporteEstado;
  archivo: string | null;
  vigencia_hasta: string | null;
  pais_emisor: string | null;
  path: string | null;
  advertencia: string | null;
};

export type Checklist = {
  hoy: string;
  items: ChecklistItem[];
  bloqueos: string[];
  listo_para_firma: boolean;
};

export async function buildChecklist(directory: string, caso: string, exigidos: string[], today: string): Promise<Checklist> {
  const dir = await caseDir(directory, caso);
  const index = await readSupportIndex(directory);
  const root = path.dirname(path.dirname(dir));
  const soportesDir = path.join(root, "repositorio", "soportes");
  const items: ChecklistItem[] = [];
  for (const tipo of exigidos) {
    const entry = index.find((item) => item.tipo === tipo) ?? null;
    if (!entry) {
      items.push({ tipo, estado: "ausente", archivo: null, vigencia_hasta: null, pais_emisor: null, path: null, advertencia: "No figura en el índice de soportes" });
      continue;
    }
    const file = await safeExisting(soportesDir, entry.archivo).catch(() => null);
    const exists = file ? (await lstat(file)).isFile() : false;
    if (!exists) {
      items.push({ tipo, estado: "ausente", archivo: entry.archivo, vigencia_hasta: entry.vigencia_hasta, pais_emisor: entry.pais_emisor, path: null, advertencia: "El índice lo menciona pero el archivo no existe" });
      continue;
    }
    const expired = isExpired(entry.vigencia_hasta, today);
    items.push({
      tipo,
      estado: expired ? "vencido" : entry.vigencia_hasta === null ? "sin_vigencia_informada" : "presente",
      archivo: entry.archivo,
      vigencia_hasta: entry.vigencia_hasta,
      pais_emisor: entry.pais_emisor,
      path: file,
      advertencia: entry.vigencia_hasta === null ? "Sin vencimiento informado: no implica que esté actualizado" : null
    });
  }
  const bloqueos = items.filter((item) => item.estado === "ausente" || item.estado === "vencido").map((item) => `${item.tipo}: ${item.estado}`);
  return { hoy: today, items, bloqueos, listo_para_firma: bloqueos.length === 0 };
}