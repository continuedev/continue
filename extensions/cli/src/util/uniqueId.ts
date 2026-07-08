import node_machine_id from "node-machine-id";

let _uniqueId: string | undefined;

/**
 * Returns a unique identifier for the current user/machine.
 * Uses CONTINUE_USER_ID env var if set, otherwise falls back to machine ID.
 */
export function getUniqueId(): string {
  if (!_uniqueId) {
    if (process.env.CONTINUE_USER_ID) {
      _uniqueId = process.env.CONTINUE_USER_ID;
    } else {
      _uniqueId = node_machine_id.machineIdSync();
    }
  }
  return _uniqueId;
}
