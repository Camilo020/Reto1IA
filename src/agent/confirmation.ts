import { normalizeToolArguments } from "../llm/deepseek.js";
import type { LlmMessage } from "../llm/adapter.js";
import { z } from "zod";
import type { ToolContext } from "../tools/contracts.js";
import type { ToolSpec } from "./dispatcher.js";

export async function invokeTool(
  specs: ToolSpec[],
  name: string,
  rawArguments: string,
  ctx: ToolContext
): Promise<{ name: string; bounded: string }> {
  const spec = specs.find((item) => item.name === name);
  if (!spec) return { name, bounded: JSON.stringify({ ok: false, error: "Herramienta desconocida" }) };
  const args = normalizeToolArguments(rawArguments);
  const parsed = z.object(spec.args).safeParse(args);
  if (!parsed.success) return { name, bounded: JSON.stringify({ ok: false, error: "Argumentos inválidos" }) };
  const bounded = await spec.execute(parsed.data as Record<string, unknown>, ctx);
  return { name, bounded };
}

export function toolMessage(toolCallId: string, content: string): LlmMessage {
  return { role: "tool", toolCallId, content };
}