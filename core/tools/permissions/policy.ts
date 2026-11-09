import type { Tool } from "../..";
import { BuiltInToolNames } from "../builtIn";
import { canonicalRuleName } from "./names";

/**
 * Five areas, each with its own level (plans/policy-areas.md). This replaces
 * the single approval mode and Loop's autonomy levels.
 */
export type PolicyArea = "context" | "tools" | "edits" | "plan" | "questions";

export const POLICY_AREAS: readonly PolicyArea[] = [
  "context",
  "tools",
  "edits",
  "plan",
  "questions",
];

/** "yolo" reads as IDGAF on Plan edits and Questions. */
export type PolicyLevel =
  "manual" | "cautious" | "automatic" | "permissive" | "yolo";

export const POLICY_LEVELS: readonly PolicyLevel[] = [
  "manual",
  "cautious",
  "automatic",
  "permissive",
  "yolo",
];

export type PolicyLevels = Record<PolicyArea, PolicyLevel>;

/** What a question is about. The agent names it when it asks. */
export type QuestionType =
  "scope" | "irreversible" | "security" | "cost" | "design" | "detail";

export const QUESTION_TYPES: readonly QuestionType[] = [
  "scope",
  "irreversible",
  "security",
  "cost",
  "design",
  "detail",
];

export const QUESTION_TYPE_DESCRIPTIONS: Record<QuestionType, string> = {
  scope: "What to build, add or drop",
  irreversible: "Deleting, publishing, migrating, anything hard to undo",
  security: "Credentials, permissions, exposure",
  cost: "Spending money or a large share of a budget",
  design: "Architecture, libraries, approaches",
  detail: "Naming, formatting, small defaults",
};

/** Whether work goes on while a question waits for the person. */
export type QuestionDelivery = "inbox" | "wait";

export type BuiltinRuleId =
  | "protect-secrets"
  | "protect-config"
  | "protect-network-paths"
  | "refuse-dangerous-commands"
  | "plan-keeps-checks";

export const BUILTIN_RULES: readonly {
  id: BuiltinRuleId;
  label: string;
  description: string;
}[] = [
  {
    id: "protect-secrets",
    label: "Ask before touching credentials",
    description:
      "Key files, tokens and credentials, for every tool and command.",
  },
  {
    id: "protect-config",
    label: "Ask before changing what runs later",
    description: "Git hooks, CI, editor tasks and shell startup files.",
  },
  {
    id: "protect-network-paths",
    label: "Ask before contacting a network path",
    description: "UNC paths, which reach another computer.",
  },
  {
    id: "refuse-dangerous-commands",
    label: "Refuse dangerous commands",
    description: "Commands the built-in safety check refuses.",
  },
  {
    id: "plan-keeps-checks",
    label: "Stop a re-plan that weakens a check",
    description:
      "A re-plan that changes a failing check or drops a finished item waits for you.",
  },
];

export interface PolicySettings {
  levels: PolicyLevels;
  /** Permissive on Plan edits: new to-dos a re-plan may add by itself. */
  maxNewPlanItems?: number;
  questions?: {
    delivery?: QuestionDelivery;
    /** Types the person always decides. */
    youDecide?: QuestionType[];
    /** Types the agent may decide. */
    agentDecides?: QuestionType[];
  };
  /** Built-in rules by id. Absent means on. */
  builtin?: Partial<Record<BuiltinRuleId, boolean>>;
}

export const DEFAULT_MAX_NEW_PLAN_ITEMS = 5;
export const DEFAULT_YOU_DECIDE: readonly QuestionType[] = [
  "scope",
  "irreversible",
  "security",
  "cost",
];
export const DEFAULT_AGENT_DECIDES: readonly QuestionType[] = ["detail"];

export const DEFAULT_POLICY_LEVELS: PolicyLevels = {
  context: "permissive",
  tools: "cautious",
  edits: "manual",
  plan: "cautious",
  questions: "cautious",
};

export type PolicyPresetName =
  "careful" | "acceptEdits" | "handsOff" | "reviewer" | "yolo";

export const POLICY_PRESETS: Record<
  PolicyPresetName,
  { label: string; description: string; levels: PolicyLevels }
> = {
  careful: {
    label: "Careful",
    description: "Reads freely, asks for commands, you review edits.",
    levels: DEFAULT_POLICY_LEVELS,
  },
  acceptEdits: {
    label: "Accept edits",
    description: "Like Careful, and edits are accepted unless denied.",
    levels: { ...DEFAULT_POLICY_LEVELS, edits: "permissive" },
  },
  handsOff: {
    label: "Hands off",
    description:
      "Runs everything your rules do not stop. The agent makes the small calls.",
    levels: {
      context: "permissive",
      tools: "permissive",
      edits: "permissive",
      plan: "permissive",
      questions: "permissive",
    },
  },
  reviewer: {
    label: "Reviewer",
    description: "A reviewer model decides what your rules leave open.",
    levels: {
      context: "automatic",
      tools: "automatic",
      edits: "automatic",
      plan: "automatic",
      questions: "automatic",
    },
  },
  yolo: {
    label: "YOLO",
    description: "Everything runs and nothing asks. Every rule is ignored.",
    levels: {
      context: "yolo",
      tools: "yolo",
      edits: "yolo",
      plan: "yolo",
      questions: "yolo",
    },
  },
};

export const POLICY_PRESET_ORDER = Object.keys(
  POLICY_PRESETS,
) as PolicyPresetName[];

export function presetOf(levels: PolicyLevels): PolicyPresetName | undefined {
  return POLICY_PRESET_ORDER.find((name) =>
    POLICY_AREAS.every((a) => POLICY_PRESETS[name].levels[a] === levels[a]),
  );
}

export const POLICY_AREA_LABELS: Record<PolicyArea, string> = {
  context: "Context use",
  tools: "Tool use",
  edits: "File edits",
  plan: "Plan edits",
  questions: "Questions",
};

export function policyLevelLabel(area: PolicyArea, level: PolicyLevel): string {
  if (level === "yolo") {
    return area === "plan" || area === "questions" ? "IDGAF" : "YOLO";
  }
  return level.charAt(0).toUpperCase() + level.slice(1);
}

/** One line per level for the dropdown; the tooltip uses the same sentence. */
export const POLICY_LEVEL_DESCRIPTIONS: Record<
  PolicyArea,
  Record<PolicyLevel, string>
> = {
  context: {
    manual: "Asks before each read.",
    cautious:
      "Reads what your allow rules and tool settings cover, asks otherwise.",
    automatic: "As Cautious, and a reviewer model decides what is left.",
    permissive: "Reads anything no rule stops.",
    yolo: "Reads anything. Every rule is ignored.",
  },
  tools: {
    manual: "Asks before each command and tool.",
    cautious:
      "Runs what your allow rules and tool settings cover, asks otherwise.",
    automatic: "As Cautious, and a reviewer model decides what is left.",
    permissive: "Runs anything no rule stops.",
    yolo: "Runs anything. Every rule is ignored.",
  },
  edits: {
    manual: "You review each diff.",
    cautious: "Accepts what your allow rules cover, you review the rest.",
    automatic: "A reviewer model accepts, refuses or sends it to you.",
    permissive: "Accepts anything no rule stops.",
    yolo: "Accepts everything. Every rule is ignored.",
  },
  plan: {
    manual: "In Loop, every plan and re-plan waits for you.",
    cautious: "In Loop, re-plans that add no to-do go on. A first plan waits.",
    automatic:
      "In Loop, a reviewer model judges each plan and waits if unsure.",
    permissive: "In Loop, plans go on. A re-plan may add a few to-dos.",
    yolo: "In Loop, every plan goes on. Nothing is checked.",
  },
  questions: {
    manual: "You decide every question.",
    cautious: "You decide, except types a rule gives the agent.",
    automatic: "A second model decides, or sends it to you if unsure.",
    permissive: "The agent decides, except types a rule gives you.",
    yolo: "The agent decides everything and never asks.",
  },
};

function isLevel(value: unknown): value is PolicyLevel {
  return POLICY_LEVELS.includes(value as PolicyLevel);
}

function questionTypes(value: unknown): QuestionType[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((v): v is QuestionType =>
    QUESTION_TYPES.includes(v as QuestionType),
  );
}

export interface NormalizedPolicy {
  policy: PolicySettings;
  /** Each value that could not be used, for a notice. */
  problems: string[];
}

/**
 * Saved or written settings made safe to use. An unknown level falls back to
 * that area's default and is reported, so nothing silently does nothing.
 */
export function normalizePolicy(raw: unknown): NormalizedPolicy {
  const input = (raw ?? {}) as Partial<PolicySettings>;
  const given = (input.levels ?? {}) as Partial<Record<string, unknown>>;
  const problems: string[] = [];
  const levels = { ...DEFAULT_POLICY_LEVELS };
  for (const area of POLICY_AREAS) {
    const value = given[area];
    if (value === undefined) continue;
    if (isLevel(value)) levels[area] = value;
    else problems.push(`${area}: "${String(value)}" is not a level`);
  }
  const delivery = input.questions?.delivery;
  if (delivery !== undefined && delivery !== "inbox" && delivery !== "wait") {
    problems.push(`questions.delivery: "${String(delivery)}" is not valid`);
  }
  const youDecide = questionTypes(input.questions?.youDecide);
  const agentDecides = questionTypes(input.questions?.agentDecides);
  return {
    policy: {
      levels,
      ...(typeof input.maxNewPlanItems === "number" &&
      input.maxNewPlanItems >= 0
        ? { maxNewPlanItems: input.maxNewPlanItems }
        : {}),
      questions: {
        delivery: delivery === "wait" ? "wait" : "inbox",
        ...(youDecide ? { youDecide } : {}),
        ...(agentDecides ? { agentDecides } : {}),
      },
      ...(input.builtin ? { builtin: input.builtin } : {}),
    },
    problems,
  };
}

export function builtinRuleOn(
  policy: PolicySettings | undefined,
  id: BuiltinRuleId,
): boolean {
  return policy?.builtin?.[id] !== false;
}

/** Automatic needs a reviewer: without one, Cautious, so nothing loosens. */
export function withoutReviewer(policy: PolicySettings): PolicySettings {
  const levels = { ...policy.levels };
  for (const area of POLICY_AREAS) {
    if (levels[area] === "automatic") levels[area] = "cautious";
  }
  return { ...policy, levels };
}

/** The old saved settings (one approval mode and its switches). */
export interface LegacyApproval {
  mode?: string;
  categories?: {
    readFiles?: boolean;
    editFiles?: boolean;
    runAllCommands?: boolean;
  };
  /** A per-tool setting lets an edit tool run without asking. */
  editToolAutoAccepted?: boolean;
}

/** Equal or stricter than what was saved, never looser. */
export function migrateApproval(old: LegacyApproval): PolicyLevels {
  const levels = { ...DEFAULT_POLICY_LEVELS };
  if (old.editToolAutoAccepted) levels.edits = "cautious";
  switch (old.mode) {
    case "autoApprove":
      if (old.categories?.readFiles) levels.context = "permissive";
      if (old.categories?.editFiles) levels.edits = "permissive";
      if (old.categories?.runAllCommands) levels.tools = "permissive";
      break;
    case "auto":
      levels.tools = "automatic";
      levels.context = "automatic";
      break;
    // A saved "yolo" is from 2.4.4, where it still honoured deny rules and
    // protected paths: carrying it over as today's YOLO would loosen it
    case "review":
    case "yolo":
      levels.tools = "permissive";
      levels.context = "permissive";
      break;
  }
  return levels;
}

const SESSION_TOOLS = new Set<string>([
  BuiltInToolNames.TaskList,
  BuiltInToolNames.PresentPlan,
  BuiltInToolNames.HoldQuestion,
  BuiltInToolNames.FinishItem,
  BuiltInToolNames.RemindMe,
  // The CLI's names
  "TaskList",
  "Checklist",
  "PresentPlan",
  "HoldQuestion",
  "FinishItem",
  "RemindMe",
  "AskQuestion",
  "Status",
  "Exit",
  "ReportFailure",
  "UploadArtifact",
  "CheckBackgroundJob",
]);

const EDIT_RULE_NAMES = new Set<string>([
  "writeFile",
  "Edit",
  "MultiEdit",
  "Write",
]);
/** Web tools can send data out, so they are never just context. */
const WEB_RULE_NAMES = new Set<string>(["fetchUrl", "searchWeb", "Fetch"]);
const CONTEXT_RULE_NAMES = new Set<string>([
  "readFile",
  "listDirectory",
  "grepSearch",
  "globSearch",
  BuiltInToolNames.ViewDiff,
  BuiltInToolNames.CodebaseTool,
  BuiltInToolNames.ViewRepoMap,
  BuiltInToolNames.ReadSkill,
  "Read",
  "List",
  "Search",
  "Diff",
  "Skills",
]);

/**
 * Which area governs a tool call. Undefined for tools that only touch the
 * session (the task list, Loop's tools): those are never asked about.
 */
export function areaOfTool(
  toolName: string,
  tool?: Pick<Tool, "readonly"> | undefined,
): "context" | "tools" | "edits" | undefined {
  if (SESSION_TOOLS.has(toolName)) return undefined;
  const name = canonicalRuleName(toolName);
  if (EDIT_RULE_NAMES.has(name)) return "edits";
  if (WEB_RULE_NAMES.has(name)) return "tools";
  if (CONTEXT_RULE_NAMES.has(name)) return "context";
  return tool?.readonly ? "context" : "tools";
}

export type QuestionDecider = "person" | "agent" | "reviewer";

/** Who decides a question. A missing or unknown type goes to the person. */
export function questionDecider(
  policy: PolicySettings,
  type: unknown,
): QuestionDecider {
  const level = policy.levels.questions;
  if (level === "yolo") return "agent";
  if (level === "manual") return "person";
  if (!QUESTION_TYPES.includes(type as QuestionType)) return "person";
  const known = type as QuestionType;
  if ((policy.questions?.youDecide ?? DEFAULT_YOU_DECIDE).includes(known)) {
    return "person";
  }
  if (
    (policy.questions?.agentDecides ?? DEFAULT_AGENT_DECIDES).includes(known)
  ) {
    return "agent";
  }
  switch (level) {
    case "automatic":
      return "reviewer";
    case "permissive":
      return "agent";
    default:
      return "person";
  }
}

export function questionDelivery(
  policy: PolicySettings | undefined,
): QuestionDelivery {
  return policy?.questions?.delivery ?? "inbox";
}

export interface PlanHandoffInput {
  policy: PolicySettings;
  /** The first plan of a run: every to-do is new, and N does not apply. */
  first: boolean;
  /** To-dos not in the list before. */
  added: number;
  /** What a re-plan weakened (see replanConcern). */
  concern?: string;
}

export interface PlanHandoff {
  /** go: on to acting. wait: for the person. review: ask the reviewer model. */
  decision: "go" | "wait" | "review";
  reason: string;
}

const count = (n: number) => `${n} new to-do${n === 1 ? "" : "s"}`;

/**
 * The one check between a plan turn and the act turn after it. Plan and Agent
 * never get here: Plan has no act turn after it, Agent no plan turn before it.
 */
export function planHandoff(input: PlanHandoffInput): PlanHandoff {
  const { policy, first, added, concern } = input;
  const level = policy.levels.plan;
  if (level === "yolo") {
    return { decision: "go", reason: "Plan edits is set to IDGAF." };
  }
  if (concern && builtinRuleOn(policy, "plan-keeps-checks")) {
    return { decision: "wait", reason: concern };
  }
  switch (level) {
    case "manual":
      return { decision: "wait", reason: "Every plan waits for you." };
    case "automatic":
      return {
        decision: "review",
        reason: "A reviewer model judges this plan.",
      };
    case "cautious":
      return added === 0 && !first
        ? { decision: "go", reason: "The re-plan adds no new to-dos." }
        : {
            decision: "wait",
            reason: first
              ? "The first plan waits for you."
              : `The re-plan adds ${count(added)}.`,
          };
    case "permissive": {
      if (first) return { decision: "go", reason: "Plan edits is Permissive." };
      const max = policy.maxNewPlanItems ?? DEFAULT_MAX_NEW_PLAN_ITEMS;
      return added <= max
        ? {
            decision: "go",
            reason: `The re-plan adds ${count(added)}, within ${max}.`,
          }
        : {
            decision: "wait",
            reason: `The re-plan adds ${count(added)}, more than ${max}.`,
          };
    }
  }
}
