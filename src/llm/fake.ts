import type { LlmAdapter, LlmMessage, LlmResponse, LlmToolDefinition } from "./adapter.js";

export class FakeAdapter implements LlmAdapter {
  readonly provider = "fake";
  readonly model = "deterministic";

  constructor(private readonly script: LlmResponse[] = []) {}

  async send(messages: LlmMessage[], _tools: LlmToolDefinition[]): Promise<LlmResponse> {
    const last = messages[messages.length - 1];
    if (last?.role === "tool") {
      return { content: `Resultado recibido: ${last.content.slice(0, 240)}`, toolCalls: [], usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } };
    }
    const next = this.script.shift();
    if (next) return next;
    return { content: "Adaptador de prueba sin guion configurado.", toolCalls: [], usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } };
  }
}