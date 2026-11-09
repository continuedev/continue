import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = resolve(__dirname, "../../../scripts/turns-eval.mjs");

function run(args: string[], env: Record<string, string> = {}) {
  const clean = { ...process.env };
  for (const k of Object.keys(clean)) {
    if (k.startsWith("TURNS_EVAL_") || k.endsWith("_API_KEY")) {
      delete clean[k];
    }
  }
  return spawnSync(process.execPath, [script, ...args], {
    env: { ...clean, ...env },
    encoding: "utf8",
    timeout: 180_000,
  });
}

describe("npm run eval:turns (scripts/turns-eval.mjs)", () => {
  it("prints usage", () => {
    const r = run(["--help"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("--ollama");
    expect(r.stdout).toContain("--strict");
    expect(r.stdout).toContain("--profile");
  });

  it("needs a model", () => {
    const r = run(["--provider", "openai"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("--model");
  });

  it("rejects an unknown option, stub or profile", () => {
    expect(run(["--nope"]).status).toBe(2);
    expect(run(["--stub", "allow-all"]).status).toBe(2);
    expect(run(["--stub", "oracle", "--profile", "terse"]).status).toBe(2);
  });

  it("will not call a hosted API without a key", () => {
    const r = run(["--provider", "openai", "--model", "m", "--yes"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("OPENAI_API_KEY");
  });

  it("will not call a hosted API without --yes, even with a key", () => {
    const r = run(["--provider", "anthropic", "--model", "m"], {
      ANTHROPIC_API_KEY: "k",
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("--yes");
    expect(r.stderr).toContain("api.anthropic.com");
  });

  it("does not need --yes or a key for a local server", () => {
    // Fails later (nothing is listening on this port), not at the guard.
    const r = run([
      "--provider",
      "openai",
      "--model",
      "m",
      "--base-url",
      "http://localhost:9/v1",
    ]);
    expect(r.stderr).not.toContain("--yes");
    expect(r.stderr).not.toContain("API key");
  });

  it("runs the oracle without any network and meets the bar", () => {
    const r = run(["--stub", "oracle", "--strict"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("### Profile: full");
    expect(r.stdout).toContain("### Profile: short");
    expect(r.stdout).toContain("Result: meets the bar.");
  });

  it("--strict gives a failing exit code when the bar is missed", () => {
    const r = run(["--stub", "text-only", "--strict"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("Result: does not meet the bar.");
    expect(r.stderr).toContain("NOT met");
  });

  it("without --strict a missed bar still exits 0, and --profile narrows the run", () => {
    const r = run(["--stub", "text-only", "--profile", "short"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("### Profile: short");
    expect(r.stdout).not.toContain("### Profile: full");
  });
});
