import { z, type ZodType } from "zod";

export type ToolContext = { directory: string; sessionId: string; authorizedCase?: string; today?: string };
export type ArgsShape = Record<string, ZodType>;

export type Tool<A extends ArgsShape = ArgsShape> = {
  description: string;
  args: A;
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
};

export type RunnableTool = { args: ArgsShape; execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown> };

export function ok(data: unknown): string {
  return JSON.stringify({ ok: true, data });
}

export function fail(error: string): string {
  return JSON.stringify({ ok: false, error });
}

export async function safeRun(tool: Tool, rawArgs: unknown, ctx: ToolContext): Promise<string> {
  const parsed = z.object(tool.args).safeParse(rawArgs ?? {});
  if (!parsed.success) return fail(parsed.error.issues.map((issue) => `${issue.path.join(".") || "arg"}: ${issue.message}`).join("; "));
  const args = parsed.data as Record<string, unknown>;
  if (ctx.authorizedCase && typeof args.caso === "string" && args.caso !== ctx.authorizedCase) {
    return fail("El caso no coincide con la acción pendiente de confirmación");
  }
  try {
    return ok(await tool.execute(args, ctx));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "error desconocido");
  }
}