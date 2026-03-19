import node_machine_id from "node-machine-id";

import { isAuthenticatedConfig, loadAuthConfig } from "../auth/workos.js";

let _uniqueId: string | undefined;

/**
 * - Continue user id from environment (when running as agent)
 * - Continue user id if signed in locally
 * - Unique machine id if not signed in
 */
export function getUniqueId(): string {
  if (!_uniqueId) {
    if (process.env.CONTINUE_USER_ID) {
      _uniqueId = process.env.CONTINUE_USER_ID;
    } else {
      const authConfig = loadAuthConfig();
      if (isAuthenticatedConfig(authConfig)) {
        _uniqueId = authConfig.userId;
      } else {
        _uniqueId = node_machine_id.machineIdSync();
      }
    }
  }
  return _uniqueId;
}
