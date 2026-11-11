import type { LlmAdapter, LlmMessage, LlmResponse, LlmToolCall, LlmToolDefinition } from "./adapter.js";

export type DeepSeekConfig = { apiKey: string; baseUrl: string; model: string; timeoutMs: number };

type WireToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type WireMessage = Record<string, unknown>;
type WireResponse = {
  choices?: { message?: { content?: string | null; tool_calls?: WireToolCall[] } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

export class DeepSeekAdapter implements LlmAdapter {
  readonly provider = "deepseek";
  readonly model: string;

  constructor(private readonly config: DeepSeekConfig) {
    this.model = config.model;
  }

  async send(messages: LlmMessage[], tools: LlmToolDefinition[]): Promise<LlmResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.config.apiKey}` },
        body: JSON.stringify({
          model: this.config.model,
          messages: messages.map(toWire),
          tools: tools.map((tool) => ({ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.parameters } })),
          tool_choice: "auto",
          stream: false
        }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`El proveedor respondió ${response.status}`);
      const body = (await response.json()) as WireResponse;
      const message = body.choices?.[0]?.message;
      if (!message) throw new Error("Respuesta del proveedor sin contenido");
      return {
        content: typeof message.content === "string" ? message.content : "",
        toolCalls: (message.tool_calls ?? []).map(toToolCall),
        usage: {
          promptTokens: body.usage?.prompt_tokens ?? 0,
          completionTokens: body.usage?.completion_tokens ?? 0,
          totalTokens: body.usage?.total_tokens ?? 0
        }
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new Error("El proveedor excedió el tiempo de espera");
      throw error instanceof Error ? error : new Error("Error de proveedor");
    } finally {
      clearTimeout(timer);
    }
  }
}

function toWire(message: LlmMessage): WireMessage {
  if (message.role === "tool") return { role: "tool", tool_call_id: message.toolCallId, content: message.content };
  if (message.role === "assistant" && message.toolCalls?.length) {
    return {
      role: "assistant",
      content: message.content,
      tool_calls: message.toolCalls.map((call) => ({ id: call.id, type: "function", function: { name: call.name, arguments: call.arguments } }))
    };
  }
  return { role: message.role, content: message.content };
}

function toToolCall(call: WireToolCall): LlmToolCall {
  return { id: call.id, name: call.function?.name ?? "", arguments: call.function?.arguments ?? "{}" };
}

export function normalizeToolArguments(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw.length ? raw : "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}