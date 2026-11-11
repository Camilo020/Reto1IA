import { z } from "zod";
import { readFile } from "node:fs/promises";
import path from "node:path";

const schema = z.object({
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().default("https://api.deepseek.com"),
  DEEPSEEK_MODEL: z.string().default("deepseek-chat"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  TZ: z.string().default("America/Bogota"),
  MAX_ITERATIONS_PER_TURN: z.coerce.number().int().min(1).max(100).default(25),
  MAX_TOKENS_PER_SESSION: z.coerce.number().int().min(1000).default(200000),
  LLM_TIMEOUT_MS: z.coerce.number().int().min(1000).default(60000),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(30),
  ACCESS_TOKEN: z.string().optional(),
  LLM_PROVIDER: z.enum(["deepseek", "fake"]).default("deepseek")
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return schema.parse(env);
}

export async function loadPrompt(directory: string): Promise<string> {
  const prompt = await readFile(path.join(directory, "agent", "prompt.md"), "utf8");
  const knowledge = await readFile(path.join(directory, "src", "knowledge", "registro-proveedor.md"), "utf8");
  return `${prompt.trim()}\n\n---\n\n# Conocimiento del proceso\n\n${knowledge.trim()}`;
}