import { tools } from "./proveedor.js";
import type { ToolSpec } from "../agent/dispatcher.js";

export const toolSpecs: ToolSpec[] = Object.entries(tools).map(([name, tool]) => ({
  name,
  description: tool.description,
  args: tool.args,
  execute: (args, ctx) => tool.execute(args as never, ctx)
}));