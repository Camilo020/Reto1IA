import type { LlmAdapter } from "../llm/adapter.js";
import { canSpend, clearConfirmation, consumeConfirmation, openConfirmation, recordSpend } from "./budget.js";
import type { Session } from "./session.js";
import { addEntry } from "./session.js";
import { invokeTool, toolMessage } from "./confirmation.js";
import type { ToolSpec } from "./dispatcher.js";
import { serializeTools } from "./dispatcher.js";
import type { ToolContext } from "../tools/contracts.js";

export type TurnResult = { reply: string; toolCalls: { name: string; args: Record<string, unknown>; result: string }[]; needsConfirmation: boolean; truncated: boolean };

type LoopOptions = { adapter: LlmAdapter; specs: ToolSpec[]; maxIterations: number; context: Omit<ToolContext, "authorizedCase">; prompt: string };
const confirmationPattern = /confirma|confirmas|¿envío|¿procedo|aprueba|autoriza/i;
const affirmativePattern = /^(si|sí|confirmo|autorizo|apruebo)(?:\s|[,.!;:]|$)/i;
const reserveTokens = 8192;

export async function runTurn(session: Session, message: string, options: LoopOptions): Promise<TurnResult> {
  if (session.busy) throw new Error("La sesión tiene un turno en curso");
  session.busy = true;
  try {
    const pendingCase = session.state.pendingCase;
    const confirmed = Boolean(pendingCase && affirmativePattern.test(message.trim()));
    if (pendingCase && !confirmed) clearConfirmation(session.state);
    addEntry(session, "user", message);
    if (!session.messages.length) session.messages.push({ role: "system", content: options.prompt });
    session.messages.push({ role: "user", content: message });
    const definitions = serializeTools(options.specs);
    const toolCalls: TurnResult["toolCalls"] = [];
    let reply = "";
    let truncated = false;
    let caseForConfirmation: string | undefined;
    let attemptedOtherCase = false;

    for (let iteration = 0; iteration < options.maxIterations; iteration += 1) {
      if (!canSpend(session.state, reserveTokens)) {
        truncated = true;
        reply = "Se alcanzó el presupuesto de tokens de la sesión; no se realizaron más llamadas al proveedor.";
        break;
      }
      const authored = await options.adapter.send(session.messages, definitions);
      recordSpend(session.state, authored.usage.totalTokens);
      session.messages.push({ role: "assistant", content: authored.content, toolCalls: authored.toolCalls });
      if (!authored.toolCalls.length) {
        reply = authored.content.trim();
        break;
      }
      for (const call of authored.toolCalls) {
        const args = safeParse(call.arguments);
        const caso = typeof args.caso === "string" ? args.caso : undefined;
        if (caso && call.name !== "proveedor_simular_envio") caseForConfirmation = caso;
        const authorizedCase = confirmed && call.name === "proveedor_simular_envio" && caso === pendingCase ? caso : undefined;
        if (confirmed && call.name === "proveedor_simular_envio" && caso !== pendingCase) attemptedOtherCase = true;
        const { bounded } = await invokeTool(options.specs, call.name, call.arguments, { ...options.context, authorizedCase });
        session.messages.push(toolMessage(call.id, bounded));
        toolCalls.push({ name: call.name, args: summarizeArgs(args), result: summarizeResult(bounded) });
      }
      if (iteration === options.maxIterations - 1) {
        truncated = true;
        reply = authored.content.trim() || "Alcancé el límite de iteraciones de este turno.";
      }
    }

    if (confirmed && pendingCase) consumeConfirmation(session.state, pendingCase);
    const needsConfirmation = !truncated && !attemptedOtherCase && confirmationPattern.test(reply) && Boolean(caseForConfirmation);
    if (needsConfirmation && caseForConfirmation) openConfirmation(session.state, caseForConfirmation, "simular_envio");
    if (!reply) reply = truncated ? "Alcancé el límite de iteraciones de este turno." : "No obtuve una respuesta del modelo.";
    addEntry(session, "assistant", reply, toolCalls);
    return { reply, toolCalls, needsConfirmation, truncated };
  } catch (error) {
    const reply = error instanceof Error ? `No pude completar el turno: ${error.message}` : "No pude completar el turno.";
    addEntry(session, "assistant", reply);
    return { reply, toolCalls: [], needsConfirmation: false, truncated: false };
  } finally {
    session.busy = false;
  }
}

function summarizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(args).map(([key, value]) => [key, key === "mapeo" ? "[mapeo verificado]" : value]));
}

function summarizeResult(raw: string): string {
  const parsed = safeParse(raw) as { ok?: boolean; error?: string; data?: Record<string, unknown> };
  if (!parsed.ok) return `error: ${parsed.error ?? "desconocido"}`;
  if (parsed.data && "listo_para_firma" in parsed.data) return `listo_para_firma=${String(parsed.data.listo_para_firma)}`;
  if (parsed.data && "ruta" in parsed.data) return `ruta=${String(parsed.data.ruta)}`;
  return "ok";
}

function safeParse(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}