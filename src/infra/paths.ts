import { lstat, mkdir, realpath } from "node:fs/promises";
import path from "node:path";

const casoPattern = /^[a-z]{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function root(directory: string): string {
  return path.resolve(directory);
}

export function fixtureRoot(directory: string): string {
  return path.join(root(directory), "fixtures", "reto-01");
}

export function outputRoot(directory: string): string {
  return path.join(root(directory), "out");
}

export function validateCaso(caso: string): void {
  if (!casoPattern.test(caso)) throw new Error("Identificador de caso inválido");
}

export async function safeExisting(base: string, ...parts: string[]): Promise<string> {
  const canonical = await realpath(base);
  const joined = path.resolve(canonical, ...parts);
  const actual = await realpath(joined);
  if (actual !== canonical && !actual.startsWith(canonical + path.sep)) {
    throw new Error("Ruta fuera del directorio permitido");
  }
  const segments = path.relative(canonical, joined).split(path.sep);
  let current = canonical;
  for (const segment of segments) {
    if (!segment || segment === ".") continue;
    current = path.join(current, segment);
    if ((await lstat(current)).isSymbolicLink()) throw new Error("Enlace simbólico no permitido");
  }
  return actual;
}

export async function caseDir(directory: string, caso: string): Promise<string> {
  validateCaso(caso);
  try {
    return await safeExisting(path.join(fixtureRoot(directory), "casos"), caso);
  } catch {
    throw new Error(`Caso inexistente o no accesible: ${caso}`);
  }
}

export async function prepareOutput(directory: string, caso: string): Promise<string> {
  validateCaso(caso);
  const base = outputRoot(directory);
  await mkdir(base, { recursive: true });
  const baseStat = await lstat(base);
  if (baseStat.isSymbolicLink()) throw new Error("Directorio de salida no permitido");
  const actual = await realpath(base);
  if (actual !== path.join(root(directory), "out")) throw new Error("Directorio de salida fuera del proyecto");
  const target = path.join(actual, caso);
  await mkdir(target, { recursive: true });
  if ((await lstat(target)).isSymbolicLink()) throw new Error("Directorio de caso no permitido");
  return target;
}

export async function safeOutputChild(directory: string, caso: string, ...parts: string[]): Promise<string> {
  const base = await prepareOutput(directory, caso);
  for (const part of parts) {
    if (part === "." || part === ".." || path.basename(part) !== part) throw new Error("Nombre de archivo inválido");
  }
  const target = path.join(base, ...parts);
  const existing = await lstat(target).catch(() => null);
  if (existing?.isSymbolicLink()) throw new Error("Enlace simbólico no permitido");
  return target;
}
