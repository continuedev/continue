/**
 * Denial tracking — ported and adapted from Marcel (Yuto Code)
 * utils/permissions/denialTracking.ts.
 *
 * Tracks consecutive and total tool-permission denials so the agent can
 * fall back to asking the user instead of blindly retrying.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type DenialTrackingState = {
  consecutiveDenials: number;
  totalDenials: number;
};

// ─── Limits ───────────────────────────────────────────────────────────────────

export const DENIAL_LIMITS = {
  /** After this many consecutive denials, fall back to prompting the user */
  maxConsecutive: 3,
  /** After this many total denials in a session, fall back to prompting */
  maxTotal: 20,
} as const;

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createDenialTrackingState(): DenialTrackingState {
  return {
    consecutiveDenials: 0,
    totalDenials: 0,
  };
}

// ─── Mutators (immutable — always return new state) ───────────────────────────

/** Call this when a tool permission was denied */
export function recordDenial(
  state: DenialTrackingState,
): DenialTrackingState {
  return {
    ...state,
    consecutiveDenials: state.consecutiveDenials + 1,
    totalDenials: state.totalDenials + 1,
  };
}

/** Call this when a tool executed successfully (resets consecutive streak) */
export function recordSuccess(
  state: DenialTrackingState,
): DenialTrackingState {
  if (state.consecutiveDenials === 0) {
    return state; // nothing to reset
  }
  return {
    ...state,
    consecutiveDenials: 0,
  };
}

/** Reset all tracking — use at session boundaries */
export function resetDenialTracking(): DenialTrackingState {
  return createDenialTrackingState();
}

// ─── Query ────────────────────────────────────────────────────────────────────

/**
 * Returns true when the agent should stop trying automated permission
 * escalation and ask the user explicitly.
 */
export function shouldFallbackToPrompting(
  state: DenialTrackingState,
): boolean {
  return (
    state.consecutiveDenials >= DENIAL_LIMITS.maxConsecutive ||
    state.totalDenials >= DENIAL_LIMITS.maxTotal
  );
}
