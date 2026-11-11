import { z, type ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ToolContext } from "../tools/contracts.js";

export type ToolSpec = {
  name: string;
  description: string;
  args: Record<string, ZodTypeAny>;
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<string>;
};

export function serializeTools(specs: ToolSpec[]): { name: string; description: string; parameters: Record<string, unknown> }[] {
  return specs.map(({ name, description, args }) => ({
    name,
    description,
    parameters: zodToJsonSchema(z.object(args), { $refStrategy: "none", target: "openApi3" }) as Record<string, unknown>
  }));
}
