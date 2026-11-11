export type LlmMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: LlmToolCall[] }
  | { role: "tool"; toolCallId: string; content: string };

export type LlmToolCall = { id: string; name: string; arguments: string };
export type LlmToolDefinition = { name: string; description: string; parameters: Record<string, unknown> };
export type LlmUsage = { promptTokens: number; completionTokens: number; totalTokens: number };
export type LlmResponse = { content: string; toolCalls: LlmToolCall[]; usage: LlmUsage };

export interface LlmAdapter {
  readonly provider: string;
  readonly model: string;
  send(messages: LlmMessage[], tools: LlmToolDefinition[]): Promise<LlmResponse>;
}