import { MessageModes } from "core";
import { RootState } from "../store";

/** What the mode picker shows: a mode, or Loop (which is not a mode). */
export type ModeEntry = MessageModes | "loop";

/**
 * Loop while the person chose it, or while a loop is going and has not been
 * asked to stop; otherwise the mode picked while a loop item finishes, or
 * the session's mode.
 */
export function selectModeEntry(state: RootState): ModeEntry {
  const { loop, loopRequested, modeAfterLoop, mode } = state.session;
  if (loopRequested) return "loop";
  if (loop && loop.status !== "stopped" && !loop.stopRequested) return "loop";
  return modeAfterLoop ?? mode;
}
