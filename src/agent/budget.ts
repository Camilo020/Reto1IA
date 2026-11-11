export type SessionState = {
  id: string;
  tokensUsed: number;
  maxTokens: number;
  pendingCase: string | null;
  pendingAction: string | null;
};

export function createSession(id: string, maxTokens: number): SessionState {
  return { id, tokensUsed: 0, maxTokens, pendingCase: null, pendingAction: null };
}

export function canSpend(state: SessionState, estimated: number): boolean {
  return state.tokensUsed + estimated <= state.maxTokens;
}

export function recordSpend(state: SessionState, tokens: number): void {
  state.tokensUsed += Math.max(0, tokens);
}

export function openConfirmation(state: SessionState, caso: string, action: string): void {
  state.pendingCase = caso;
  state.pendingAction = action;
}

export function consumeConfirmation(state: SessionState, caso: string): boolean {
  if (!state.pendingCase || state.pendingCase !== caso) return false;
  const action = state.pendingAction;
  state.pendingCase = null;
  state.pendingAction = null;
  return action === "simular_envio";
}

export function clearConfirmation(state: SessionState): void {
  state.pendingCase = null;
  state.pendingAction = null;
}