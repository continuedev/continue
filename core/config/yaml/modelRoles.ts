/**
 * The roles the Assign table edits. Others (embed, rerank) are kept as they
 * are. In a module of its own, with no imports, because the GUI uses it and
 * the GUI bundle cannot take Node-only modules (saveModelRoles reads files).
 */
export const ASSIGNABLE_ROLES = [
  "chat",
  "edit",
  "apply",
  "autocomplete",
  "subagent",
  "summarize",
] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];
