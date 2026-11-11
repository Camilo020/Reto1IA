import type { LlmMessage } from "../llm/adapter.js";
import type { SessionState } from "./budget.js";
import { createSession } from "./budget.js";

export type ToolCallEvent = { name: string; args: Record<string, unknown>; result: string };
export type ChatEntry = { role: "user" | "assistant"; content: string; toolCalls?: ToolCallEvent[]; timestamp: string };
export type Session = {
  state: SessionState;
  history: ChatEntry[];
  messages: LlmMessage[];
  busy: boolean;
};

export class Sessions {
  private readonly sessions = new Map<string, Session>();

  get(id: string, maxTokens: number): Session {
    let session = this.sessions.get(id);
    if (!session) {
      session = { state: createSession(id, maxTokens), history: [], messages: [], busy: false };
      this.sessions.set(id, session);
    }
    return session;
  }

  find(id: string): Session | undefined {
    return this.sessions.get(id);
  }
}

export function addEntry(session: Session, role: ChatEntry["role"], content: string, toolCalls?: ToolCallEvent[]): ChatEntry {
  const entry: ChatEntry = { role, content, timestamp: new Date().toISOString(), ...(toolCalls ? { toolCalls } : {}) };
  session.history.push(entry);
  return entry;
}