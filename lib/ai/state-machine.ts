import { ConversationState, ConversationSession, PendingAction } from './types';

// Strict state transition map defining allowed state transitions
const VALID_TRANSITIONS: Record<ConversationState, ConversationState[]> = {
  IDLE: ['DISCOVERY', 'RECOMMENDATION', 'RESERVATION', 'ORDERING', 'WAITING_CONFIRMATION', 'HUMAN_HANDOFF', 'IDLE'],
  DISCOVERY: ['RECOMMENDATION', 'RESERVATION', 'ORDERING', 'WAITING_CONFIRMATION', 'PROCESSING', 'COMPLETED', 'HUMAN_HANDOFF', 'IDLE'],
  RECOMMENDATION: ['DISCOVERY', 'ORDERING', 'RESERVATION', 'WAITING_CONFIRMATION', 'HUMAN_HANDOFF', 'IDLE'],
  RESERVATION: ['WAITING_CONFIRMATION', 'DISCOVERY', 'CANCELLED', 'HUMAN_HANDOFF', 'IDLE'],
  ORDERING: ['WAITING_CONFIRMATION', 'DISCOVERY', 'CANCELLED', 'HUMAN_HANDOFF', 'IDLE'],
  WAITING_CONFIRMATION: ['PROCESSING', 'COMPLETED', 'CANCELLED', 'DISCOVERY', 'HUMAN_HANDOFF', 'IDLE'],
  PROCESSING: ['COMPLETED', 'FAILED', 'CANCELLED'],
  COMPLETED: ['IDLE', 'DISCOVERY', 'RESERVATION', 'ORDERING'],
  CANCELLED: ['IDLE', 'DISCOVERY', 'RESERVATION', 'ORDERING'],
  HUMAN_HANDOFF: ['IDLE', 'DISCOVERY'],
  FAILED: ['IDLE', 'DISCOVERY', 'HUMAN_HANDOFF'],
};

export class ConversationStateMachine {
  /**
   * Check if transitioning from currentState to nextState is legally allowed
   */
  public static canTransition(from: ConversationState, to: ConversationState): boolean {
    if (from === to) return true;
    const allowed = VALID_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  /**
   * Apply state transition with optimistic version bump
   */
  public static transition(
    session: ConversationSession,
    nextState: ConversationState,
    pendingAction?: PendingAction | null
  ): ConversationSession {
    if (!this.canTransition(session.state, nextState)) {
      console.warn(
        `[FSM Warning] Illegal transition attempt from ${session.state} to ${nextState}. Falling back to DISCOVERY.`
      );
      nextState = 'DISCOVERY';
    }

    const updatedSession: ConversationSession = {
      ...session,
      state: nextState,
      stateVersion: session.stateVersion + 1,
      pendingAction: pendingAction !== undefined ? pendingAction : session.pendingAction,
      lastInteractionAt: Date.now(),
    };

    // If transitioning out of confirmation or to completed/cancelled, clear stale pending actions
    if (nextState === 'COMPLETED' || nextState === 'CANCELLED' || nextState === 'IDLE') {
      updatedSession.pendingAction = null;
    }

    return updatedSession;
  }

  /**
   * Check if any pending confirmation in session has timed out (e.g. lease expired)
   */
  public static checkTimeout(session: ConversationSession): ConversationSession {
    if (session.state === 'WAITING_CONFIRMATION' && session.pendingAction) {
      if (Date.now() > session.pendingAction.expiresAt) {
        return this.transition(session, 'CANCELLED', null);
      }
    }
    return session;
  }
}
