#!/usr/bin/env node
/**
 * Run the Auto reviewer evaluation (core/tools/permissions/auto/evaluation)
 * against a model and print the quality-bar report.
 *
 *   npm run eval:reviewer -- --help
 *
 * This is a thin wrapper around live.vitest.ts, which reads the
 * REVIEWER_EVAL_* environment variables. It adds flags, a check that you meant
 * to call a hosted API, and an exit code.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HELP = `Usage: npm run eval:reviewer -- [options]

Sends each of the ~200 labelled tool calls to a reviewer model (real code path:
rules and safety check first, then the model) and prints the quality-bar report.

Model (pick one way):
  --provider openai --model <id> [--base-url <url>]   OpenAI or any OpenAI-compatible server
  --provider anthropic --model <id>                   Anthropic Messages API
  --ollama --model <name> [--host http://localhost:11434]   local Ollama (no key, no cost)

Options:
  --api-key-env <NAME>   Environment variable that holds the key
                         (default OPENAI_API_KEY, or ANTHROPIC_API_KEY for anthropic)
  --yes                  Confirm you mean to call a hosted API. Required unless the
                         server is on localhost: a full run is about 200 requests
                         and is billed by the provider.
  --strict               Exit 1 if the report does not meet the bar
  --out <file>           Also write the markdown report to a file
  --stub oracle|allow-all|ask-all   Run with a stand-in instead of a model (no network;
                         checks that the harness and the bar work)
  -h, --help

Environment (alternative to flags): REVIEWER_EVAL_PROVIDER, REVIEWER_EVAL_MODEL,
REVIEWER_EVAL_BASE_URL, REVIEWER_EVAL_API_KEY, REVIEWER_EVAL_OUT.

Examples:
  npm run eval:reviewer -- --stub oracle
  npm run eval:reviewer -- --ollama --model qwen2.5-coder:7b --out ollama.md
  OPENAI_API_KEY=... npm run eval:reviewer -- --provider openai --model gpt-4.1-mini --yes --strict
  ANTHROPIC_API_KEY=... npm run eval:reviewer -- --provider anthropic --model claude-haiku-4-5 --yes
`;

function parse(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) fail(`${a} needs a value`);
      return v;
    };
    switch (a) {
      case "-h":
      case "--help":
        o.help = true;
        break;
      case "--provider":
        o.provider = next();
        break;
      case "--model":
        o.model = next();
        break;
      case "--base-url":
        o.baseUrl = next();
        break;
      case "--host":
        o.host = next();
        break;
      case "--ollama":
        o.ollama = true;
        break;
      case "--api-key-env":
        o.keyEnv = next();
        break;
      case "--yes":
        o.yes = true;
        break;
      case "--strict":
        o.strict = true;
        break;
      case "--out":
        o.out = next();
        break;
      case "--stub":
        o.stub = next();
        break;
      default:
        fail(`Unknown option ${a}. Try --help.`);
    }
  }
  return o;
}

function fail(msg) {
  console.error(msg);
  process.exit(2);
}

const isLocal = (url) => {
  try {
    const h = new URL(url).hostname;
    return (
      h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]"
    );
  } catch {
    return false;
  }
};

const opts = parse(process.argv.slice(2));
if (opts.help) {
  console.log(HELP);
  process.exit(0);
}

const env = { ...process.env };
let target;

if (opts.stub) {
  if (!["oracle", "allow-all", "ask-all"].includes(opts.stub)) {
    fail("--stub must be oracle, allow-all or ask-all");
  }
  env.REVIEWER_EVAL_STUB = opts.stub;
  target = `stub:${opts.stub}`;
} else {
  let provider =
    opts.provider ??
    env.REVIEWER_EVAL_PROVIDER ??
    (opts.ollama ? "openai" : "");
  const model = opts.model ?? env.REVIEWER_EVAL_MODEL;
  if (!model) fail("Give a model with --model (or use --stub). See --help.");
  if (!provider) fail("Give --provider openai|anthropic, or --ollama.");
  if (!["openai", "anthropic"].includes(provider)) {
    fail("--provider must be openai or anthropic");
  }

  let baseUrl = opts.baseUrl ?? env.REVIEWER_EVAL_BASE_URL;
  if (opts.ollama) {
    baseUrl = `${(opts.host ?? "http://localhost:11434").replace(/\/$/, "")}/v1`;
  }
  const effectiveUrl =
    baseUrl ??
    (provider === "anthropic"
      ? "https://api.anthropic.com"
      : "https://api.openai.com/v1");

  const local = isLocal(effectiveUrl);
  const keyName =
    opts.keyEnv ??
    (provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY");
  const key = env.REVIEWER_EVAL_API_KEY ?? env[keyName] ?? "";

  if (!local) {
    if (!key) fail(`No API key: set ${keyName} (or REVIEWER_EVAL_API_KEY).`);
    if (!opts.yes) {
      fail(
        `This sends about 200 requests to ${new URL(effectiveUrl).host}, which the provider bills.\n` +
          "Re-run with --yes to go ahead, or use --ollama / a localhost --base-url.",
      );
    }
  }

  env.REVIEWER_EVAL_PROVIDER = provider;
  env.REVIEWER_EVAL_MODEL = model;
  if (baseUrl) env.REVIEWER_EVAL_BASE_URL = baseUrl;
  if (key) env.REVIEWER_EVAL_API_KEY = key;
  target = `${provider}:${model}${local ? " (local)" : ""}`;
}

const dir = mkdtempSync(join(tmpdir(), "reviewer-eval-"));
const resultFile = join(dir, "result.json");
env.REVIEWER_EVAL_RESULT = resultFile;
if (opts.out) env.REVIEWER_EVAL_OUT = resolve(opts.out);

const coreDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
console.error(`Running the reviewer evaluation against ${target} ...`);
const run = spawnSync(
  "npx",
  [
    "vitest",
    "run",
    "tools/permissions/auto/evaluation/live.vitest.ts",
    "--reporter=dot",
  ],
  {
    cwd: coreDir,
    env,
    stdio: ["ignore", "inherit", "inherit"],
    shell: process.platform === "win32",
  },
);

let passed;
if (existsSync(resultFile)) {
  try {
    passed = JSON.parse(readFileSync(resultFile, "utf8")).passed;
  } catch {
    // fall through
  }
}
rmSync(dir, { recursive: true, force: true });

if (run.status !== 0 || passed === undefined) {
  console.error("The evaluation did not complete (see the output above).");
  process.exit(run.status || 1);
}
console.error(
  passed
    ? "Quality bar: met."
    : `Quality bar: NOT met.${opts.strict ? "" : " (pass --strict to fail the exit code)"}`,
);
process.exit(opts.strict && !passed ? 1 : 0);
