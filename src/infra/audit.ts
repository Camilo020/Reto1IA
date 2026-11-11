import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { outputRoot, validateCaso } from "./paths.js";

export async function audit(directory: string, caso: string, herramienta: string, ok: boolean, resumen: string): Promise<void> {
  validateCaso(caso);
  const root = outputRoot(directory);
  const target = path.join(root, caso);
  await mkdir(target, { recursive: true });
  const line = JSON.stringify({ ts: new Date().toISOString(), herramienta, ok, resumen }) + "\n";
  await Promise.all([appendFile(path.join(root, "log.jsonl"), line), appendFile(path.join(target, "log.jsonl"), line)]);
}