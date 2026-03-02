import { AsyncLocalStorage } from "node:async_hooks";

import type { ToolPermissionServiceState } from "./ToolPermissionService.js";

interface ExecutionContext {
  executionId: string;
  systemMessage: string;
  permissions: ToolPermissionServiceState;
}

/* Scopes system message and permissions per subagent execution, enabling parallel execution without global mutations*/
export const executionContext = new AsyncLocalStorage<ExecutionContext>();
