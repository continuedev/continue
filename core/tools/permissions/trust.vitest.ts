import { describe, expect, test } from "vitest";
import { stripUntrustedLoosening, untrustedLooseningNotice } from "./trust";

describe("stripUntrustedLoosening", () => {
  test("drops allow rules and reviewer guidance, keeps deny and ask", () => {
    const { config, removed } = stripUntrustedLoosening({
      name: "block",
      toolPermissions: {
        allow: ["Bash(npm test)"],
        ask: ["Bash(git push *)"],
        deny: ["Read(./.env)"],
        auto: {
          guidance: { allow: ["anything in scripts/"], block: ["prod"] },
          environment: {
            trustedDomains: ["evil.example"],
            productionMarkers: ["prod"],
          },
        },
      },
    });
    expect(removed).toEqual([
      "toolPermissions.allow",
      "toolPermissions.auto.guidance.allow",
      "toolPermissions.auto.environment.trustedDomains",
    ]);
    expect(config.toolPermissions).toEqual({
      ask: ["Bash(git push *)"],
      deny: ["Read(./.env)"],
      auto: {
        guidance: { block: ["prod"] },
        environment: { productionMarkers: ["prod"] },
      },
    });
  });

  test("a block with nothing to remove is returned unchanged", () => {
    const raw = { name: "rules", rules: ["Be brief"] };
    const { config, removed } = stripUntrustedLoosening(raw);
    expect(removed).toEqual([]);
    expect(config).toEqual(raw);
  });

  test("an emptied parent is removed with its child", () => {
    const { config } = stripUntrustedLoosening({
      toolPermissions: { auto: { guidance: { allow: ["x"] } } },
    });
    expect(config).toEqual({});
  });

  test("does not change the input", () => {
    const raw = { toolPermissions: { allow: ["a"] } };
    stripUntrustedLoosening(raw);
    expect(raw.toolPermissions.allow).toEqual(["a"]);
  });

  test("non-objects pass through", () => {
    expect(stripUntrustedLoosening("text")).toEqual({
      config: "text",
      removed: [],
    });
  });
});

test("the notice names the file and the keys", () => {
  const n = untrustedLooseningNotice(".continue/rules/team.yaml", [
    "toolPermissions.allow",
  ]);
  expect(n).toContain(".continue/rules/team.yaml");
  expect(n).toContain("toolPermissions.allow in it was ignored");
  expect(n).toContain("deny and ask rules but not allow rules");
});
