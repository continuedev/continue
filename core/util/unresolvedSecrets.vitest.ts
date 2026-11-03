import { describe, expect, it } from "vitest";

import {
  findSecretNames,
  findUnresolvedSecrets,
  isValidSecretName,
  MissingSecretError,
  parseMissingSecretNames,
  unresolvedSecretNamesOfLlm,
} from "./unresolvedSecrets";

describe("findSecretNames", () => {
  it("finds a plain reference", () => {
    expect(findSecretNames("${{ secrets.ANTHROPIC_API_KEY }}")).toEqual([
      "ANTHROPIC_API_KEY",
    ]);
  });

  it("tolerates spacing differences", () => {
    expect(findSecretNames("${{secrets.A}}")).toEqual(["A"]);
    expect(findSecretNames("${{   secrets.A   }}")).toEqual(["A"]);
  });

  it("returns only the last part of a packaged secret", () => {
    expect(findSecretNames("${{ secrets.owner/pkg/MY_KEY }}")).toEqual([
      "MY_KEY",
    ]);
  });

  it("returns each name once", () => {
    expect(findSecretNames("${{ secrets.A }}-${{ secrets.A }}")).toEqual(["A"]);
  });

  it("ignores other template namespaces and non-strings", () => {
    expect(findSecretNames("${{ inputs.X }}")).toEqual([]);
    expect(findSecretNames("sk-abc123")).toEqual([]);
    expect(findSecretNames(undefined)).toEqual([]);
    expect(findSecretNames(42)).toEqual([]);
  });
});

describe("findUnresolvedSecrets", () => {
  const model = (
    name: string,
    provider: string,
    extra: Record<string, unknown> = {},
  ) => ({ name, provider, ...extra });

  it("reports nothing when every credential has a value", () => {
    expect(
      findUnresolvedSecrets([model("A", "anthropic", { apiKey: "sk-real" })]),
    ).toEqual([]);
  });

  it("groups models that share one secret", () => {
    const result = findUnresolvedSecrets([
      model("Sonnet", "anthropic", { apiKey: "${{ secrets.AK }}" }),
      model("Opus", "anthropic", { apiKey: "${{ secrets.AK }}" }),
      model("GPT", "openai", { apiKey: "${{ secrets.OK }}" }),
    ]);
    expect(result).toEqual([
      {
        secretName: "AK",
        modelNames: ["Sonnet", "Opus"],
        providers: ["anthropic"],
      },
      { secretName: "OK", modelNames: ["GPT"], providers: ["openai"] },
    ]);
  });

  it("scans AWS credentials under env and request headers", () => {
    const result = findUnresolvedSecrets([
      model("B", "bedrock", {
        env: {
          accessKeyId: "${{ secrets.AWS_ID }}",
          secretAccessKey: "${{ secrets.AWS_SECRET }}",
          region: "us-east-1",
        },
        requestOptions: { headers: { "x-api-key": "${{ secrets.HDR }}" } },
      }),
    ]);
    expect(result.map((r) => r.secretName).sort()).toEqual([
      "AWS_ID",
      "AWS_SECRET",
      "HDR",
    ]);
  });

  it("does not scan fields that are not credentials", () => {
    expect(
      findUnresolvedSecrets([
        model("M", "openai", {
          apiKey: "sk-real",
          env: { region: "${{ secrets.NOT_A_CREDENTIAL }}" },
        }),
      ]),
    ).toEqual([]);
  });
});

describe("unresolvedSecretNamesOfLlm", () => {
  it("is empty for a normal key", () => {
    expect(unresolvedSecretNamesOfLlm({ apiKey: "sk-real" })).toEqual([]);
    expect(unresolvedSecretNamesOfLlm({})).toEqual([]);
  });

  it("names the missing secret", () => {
    expect(unresolvedSecretNamesOfLlm({ apiKey: "${{ secrets.AK }}" })).toEqual(
      ["AK"],
    );
  });
});

describe("MissingSecretError", () => {
  it("names the model and the secret", () => {
    const err = new MissingSecretError("Claude", ["AK"]);
    expect(err.message).toContain('"Claude"');
    expect(err.message).toContain("AK");
    expect(err.message).toContain(".env");
  });

  it("can be read back from its message text", () => {
    expect(
      parseMissingSecretNames(new MissingSecretError("C", ["AK"]).message),
    ).toEqual(["AK"]);
    expect(
      parseMissingSecretNames(
        new MissingSecretError("C", ["AK", "BK"]).message,
      ),
    ).toEqual(["AK", "BK"]);
  });

  it("returns nothing for an unrelated error", () => {
    expect(parseMissingSecretNames("401 Unauthorized")).toEqual([]);
    expect(parseMissingSecretNames(undefined)).toEqual([]);
  });
});

describe("isValidSecretName", () => {
  it("accepts names that are safe to write as NAME=", () => {
    expect(isValidSecretName("ANTHROPIC_API_KEY")).toBe(true);
    expect(isValidSecretName("_x1")).toBe(true);
  });

  it("rejects anything that could break out of a .env line", () => {
    expect(isValidSecretName("")).toBe(false);
    expect(isValidSecretName("1ABC")).toBe(false);
    expect(isValidSecretName("A B")).toBe(false);
    expect(isValidSecretName("A=B")).toBe(false);
    expect(isValidSecretName("A\nB=evil")).toBe(false);
  });
});
