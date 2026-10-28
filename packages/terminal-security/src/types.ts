/**
 * Policy for tool execution
 */
export type ToolPolicy =
  | "allowedWithPermission"
  | "allowedWithoutPermission"
  | "disabled";

export interface TyposquatTargetWarning {
  type: "typosquat-target";
  packageName: string;
  suspectedPackageName: string;
  distance: number;
}

export type TerminalSecurityWarning = TyposquatTargetWarning;

export interface TerminalCommandSecurityEvaluation {
  policy: ToolPolicy;
  warnings?: TerminalSecurityWarning[];
}

export interface TerminalCommandSecurityOptions {
  includeWarnings?: boolean;
}
