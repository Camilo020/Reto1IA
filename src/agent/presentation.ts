import type { ChatEntry } from "./session.js";
import { z } from "zod";

const safePattern = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+|900123456|03100012345|71555123|COLOCOBM/g;

export function redact(text: string): string {
  return text.replace(safePattern, "[DATO REDACTADO]");
}

export function serializeHistory(history: ChatEntry[]): string {
  return history
    .map((entry) => {
      const calls = entry.toolCalls?.map((call) => `  - ${call.name}: ${call.result}`).join("\n") ?? "";
      return `[${entry.role}] ${entry.content}${calls ? `\n${calls}` : ""}`;
    })
    .join("\n\n");
}

export const chatRequestSchema = z.object({
  sessionId: z.string().min(1).max(128),
  message: z.string().min(1).max(4000)
});