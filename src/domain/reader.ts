import path from "node:path";
import { z } from "zod";
import { caseDir, fixtureRoot, safeExisting } from "../infra/paths.js";
import { readJson } from "../infra/files.js";
import { campoSchema, celdaSchema, solicitudSchema, type Caso, type Campo, type Celda, type Soporte } from "./schemas.js";

const soportesExigidosSchema = z.array(z.string().min(1));
const glosarioSchema = z.record(z.string());
const maestroSchema = z.record(z.unknown());

export async function readCaso(directory: string, caso: string): Promise<Caso> {
  const dir = await caseDir(directory, caso);
  const solicitud = solicitudSchema.parse(await readJson<unknown>(await safeExisting(dir, "solicitud.json")));
  const supports = soportesExigidosSchema.parse(await readJson<unknown>(await safeExisting(dir, "soportes-exigidos.json")));
  const descriptorFile = solicitud.formato === "xlsx" ? "plantilla-celdas.json" : "plantilla-campos.json";
  const raw = await readJson<unknown>(await safeExisting(dir, descriptorFile));
  const schema = solicitud.formato === "xlsx" ? z.array(celdaSchema) : z.array(campoSchema);
  return { solicitud, campos: schema.parse(raw), soportes: supports } as Caso;
}

export async function readMaster(directory: string): Promise<Record<string, unknown>> {
  return maestroSchema.parse(await readJson<unknown>(await safeExisting(path.join(fixtureRoot(directory), "repositorio"), "maestro.json")));
}

export async function readGlossary(directory: string): Promise<Record<string, string>> {
  return glosarioSchema.parse(await readJson<unknown>(await safeExisting(fixtureRoot(directory), "glosario-campos.json")));
}

export async function readSupportIndex(directory: string): Promise<Soporte[]> {
  return z.array(z.object({
    tipo: z.string(), archivo: z.string(), vigencia_hasta: z.string().nullable(), pais_emisor: z.string(), descripcion: z.string()
  })).parse(await readJson<unknown>(await safeExisting(path.join(fixtureRoot(directory), "repositorio", "soportes"), "index.json")));
}

export function isCell(item: Celda | Campo): item is Celda {
  return "hoja" in item;
}
