import type { ConfigValidationError } from "@continuedev/config-yaml";
import { describe, expect, it } from "vitest";

import {
  missingSecretsForModel,
  missingSecretsFromErrors,
  missingSecretSummary,
  modelHasMissingSecret,
  otherErrors,
  providerLabel,
} from "./missingSecrets";

const secretError = (
  secretName: string,
  providers: string[],
  modelNames: string[],
): ConfigValidationError => ({
  fatal: false,
  message: `${secretName} missing`,
  action: { kind: "setSecret", secretName, providers, modelNames },
});

const plainError: ConfigValidationError = { fatal: false, message: "other" };

describe("missingSecretsFromErrors", () => {
  it("returns nothing for no errors", () => {
    expect(missingSecretsFromErrors(undefined)).toEqual([]);
    expect(missingSecretsFromErrors([])).toEqual([]);
  });

  it("picks out only the missing-secret errors", () => {
    expect(
      missingSecretsFromErrors([
        plainError,
        secretError("AK", ["anthropic"], ["Claude"]),
      ]),
    ).toEqual([
      { secretName: "AK", providers: ["anthropic"], modelNames: ["Claude"] },
    ]);
  });

  it("lists a secret once even if reported twice", () => {
    expect(
      missingSecretsFromErrors([
        secretError("AK", ["anthropic"], ["A"]),
        secretError("AK", ["anthropic"], ["A"]),
      ]),
    ).toHaveLength(1);
  });
});

describe("otherErrors", () => {
  it("excludes missing-secret errors", () => {
    expect(
      otherErrors([plainError, secretError("AK", ["anthropic"], ["A"])]),
    ).toEqual([plainError]);
  });
});

describe("missingSecretSummary", () => {
  it("is empty when nothing is missing", () => {
    expect(missingSecretSummary([])).toBe("");
  });

  it("names the provider when there is one", () => {
    expect(
      missingSecretSummary([
        { secretName: "AK", providers: ["anthropic"], modelNames: [] },
      ]),
    ).toBe("Anthropic key is not set on this machine");
  });

  it("counts providers when there are several", () => {
    expect(
      missingSecretSummary([
        { secretName: "AK", providers: ["anthropic"], modelNames: [] },
        { secretName: "OK", providers: ["openai"], modelNames: [] },
      ]),
    ).toBe("2 API keys are not set on this machine");
  });

  it("falls back to the raw provider name", () => {
    expect(providerLabel("someprovider")).toBe("someprovider");
  });
});

describe("missingSecretsForModel", () => {
  const all = [
    { secretName: "AK", providers: ["anthropic"], modelNames: ["Claude"] },
    { secretName: "OK", providers: ["openai"], modelNames: ["GPT"] },
  ];

  it("keeps only the secrets that model uses", () => {
    expect(missingSecretsForModel(all, "GPT").map((s) => s.secretName)).toEqual(
      ["OK"],
    );
  });

  it("returns everything with no title", () => {
    expect(missingSecretsForModel(all, undefined)).toHaveLength(2);
  });
});

describe("modelHasMissingSecret", () => {
  it("recognises the missing-secret status only", () => {
    expect(
      modelHasMissingSecret({
        configurationStatus: "missing-env-secret" as any,
      }),
    ).toBe(true);
    expect(modelHasMissingSecret({ configurationStatus: "valid" as any })).toBe(
      false,
    );
    expect(modelHasMissingSecret(null)).toBe(false);
  });
});
