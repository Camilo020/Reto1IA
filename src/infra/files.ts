import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export async function readJson<T>(file: string): Promise<T> {
  const text = await readFile(file, "utf8");
  return JSON.parse(text) as T;
}

export async function readJsonSafe<T>(file: string): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await readJson<T>(file) };
  } catch (error) {
    return { ok: false, error: diagnostic(error) };
  }
}

export async function readText(file: string): Promise<string> {
  return readFile(file, "utf8");
}

export async function writeFileAtomic(file: string, content: string | Uint8Array): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temp, content);
  await rename(temp, file);
}

export async function copyFileAtomic(source: string, target: string): Promise<void> {
  const data = await readFile(source);
  await writeFileAtomic(target, data);
}

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function cleanDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
}

export function diagnostic(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("ENOENT")) return "archivo no encontrado";
    if (error instanceof SyntaxError) return "JSON inválido";
    return error.message.split("\n")[0] ?? "error desconocido";
  }
  return "error desconocido";
}