import { describe, expect, test } from "vitest";

import { approvalLoosening } from "./approval";
import { decideToolCall, type DecideInput } from "./decide";
import { parsePermissions } from "./names";

const denyRm = parsePermissions({ deny: ["runTerminalCommand(rm *)"] });
const askGit = parsePermissions({ ask: ["runTerminalCommand(git *)"] });

function looseningFor(mode: "yolo" | "review") {
  return approvalLoosening({
    approval: { mode },
    toolName: "run_terminal_command",
    parsedArgs: {},
  } as never);
}

const call = (over: Partial<DecideInput>): DecideInput => ({
  toolName: "run_terminal_command",
  parsedArgs: { command: "rm -rf build" },
  base: "allowedWithPermission",
  evaluated: "allowedWithPermission",
  rules: [],
  ...over,
});

const protectedHit = { kind: "path", path: ".env" } as never;

describe.each([
  ["a deny rule", { rules: denyRm }],
  ["an ask rule", { rules: askGit, parsedArgs: { command: "git push" } }],
  ["the safety floor", { evaluated: "disabled" as const }],
  ["a protected path", { protectedHit }],
])("with %s", (_name, over) => {
  test("YOLO allows the call", () => {
    expect(
      decideToolCall(call({ ...over, loosening: looseningFor("yolo") })),
    ).toMatchObject({
      policy: "allowedWithoutPermission",
      source: "yolo",
    });
  });

  test("Review mode leaves it as it was", () => {
    const decided = decideToolCall(
      call({ ...over, loosening: looseningFor("review") }),
    );
    expect(decided.source).not.toBe("review");
    expect(decided.policy).not.toBe("allowedWithoutPermission");
  });
});

test("Review mode allows a call nothing has settled", () => {
  expect(
    decideToolCall(call({ loosening: looseningFor("review") })),
  ).toMatchObject({
    policy: "allowedWithoutPermission",
    source: "review",
  });
});

test("a tool switched off stays off, even in YOLO", () => {
  expect(
    decideToolCall(
      call({
        base: "disabled",
        evaluated: "disabled",
        loosening: looseningFor("yolo"),
      }),
    ).policy,
  ).toBe("disabled");
});
