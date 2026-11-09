#!/usr/bin/env node
// Tier 2 of the model benchmark (plans/model-benchmark.md): runs scenario
// files through `cn serve` against one matrix row and plays the person. One
// folder per run with the config and permissions it wrote, the seed
// repository, the serve log, the request dumps, a /state snapshot after
// every turn, and a result JSON with the record fields of the plan's
// "Scoring" section. bench/score.mjs turns a results folder into records
// and scorecards.
//
// Generalised from the scratch harnesses (suite.mjs and its copies): the
// scenarios moved to bench/scenarios/*.json, the model rows to
// bench/matrix.yaml, the settings to flags.
import { execFileSync, execSync, spawn, spawnSync } from "child_process";
import { createHash } from "crypto";
import fs from "fs";
import net from "net";
import os from "os";
import path from "path";

import YAML from "yaml";

import {
  argsOf,
  BENCH_ROOT,
  fillFromState,
  findModelRow,
  listScenarios,
  loadMatrix,
  loadScenario,
  nameOf,
  REPO_ROOT,
  slug,
  textOf,
  toolCalls,
  writeJson,
} from "./src/common.mjs";

const HELP = `Usage: node bench/runner.mjs --model <row> --scenarios a,b [options]

Runs each scenario N times against one model row of bench/matrix.yaml through
\`cn serve\`, and writes one folder per run under --out.

Required
  --model <row>            matrix row id (nova2lite, haiku45, strata, ...) or a model id
  --scenarios <a,b,...>    scenario names from bench/scenarios (or "all", or a group:
                           guidance, compliance, safety)

Settings
  --profile full|short     prompt profile for the run (CONTINUE_PROMPT_PROFILE); default: the model's own
  --level <area=level,..>  policy levels, recorded on every record; applied where the CLI has the
                           knob today (tool-use=yolo adds --auto, tool-use=manual removes it;
                           plan-edits and questions pick the loop autonomy); the rest is recorded only
  --effort <x>             reasoning effort as the family spells it (see matrix.yaml efforts)
  --max-tokens <n>         defaultCompletionOptions.maxTokens (default: the provider's)
  --context <n>            defaultCompletionOptions.contextLength (default: the row's or provider's)
  --compact-ratio <r>      contextManagement.autoCompactRatio
  --runs <n>               runs per scenario (default 3)

Where
  --out <dir>              results folder (default: <tmp>/bench-results/<timestamp>); keep it outside the repository
  --cn <path>              CLI bundle (default extensions/cli/dist/cn.js)
  --port-base <n>          first port to try (default 9700)
  --matrix <file>          another matrix file

Other
  --dry-run                write the config, permissions and seed for each run and print the serve command; start nothing
  --list                   list scenarios and matrix rows
  --help

Environment: AWS_PROFILE / AWS region come from the matrix provider block unless set already;
CONTINUE_DUMP_REQUESTS is set per run to <run>/requests.`;

// ---------------------------------------------------------------------------
// Arguments

function parseArgs(argv) {
  const opts = {
    runs: 3,
    portBase: 9700,
    scenarios: [],
    dryRun: false,
    list: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    switch (a) {
      case "--model":
        opts.model = next();
        break;
      case "--scenarios":
        opts.scenarios = next()
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case "--profile":
        opts.profile = next();
        break;
      case "--level":
        opts.levels = parseLevels(next());
        break;
      case "--effort":
        opts.effort = next();
        break;
      case "--max-tokens":
        opts.maxTokens = Number(next());
        break;
      case "--context":
        opts.context = Number(next());
        break;
      case "--compact-ratio":
        opts.compactRatio = Number(next());
        break;
      case "--runs":
        opts.runs = Number(next());
        break;
      case "--out":
        opts.out = next();
        break;
      case "--cn":
        opts.cn = next();
        break;
      case "--port-base":
        opts.portBase = Number(next());
        break;
      case "--matrix":
        opts.matrix = next();
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--list":
        opts.list = true;
        break;
      case "--help":
      case "-h":
        opts.help = true;
        break;
      default:
        throw new Error(`Unknown option ${a}\n\n${HELP}`);
    }
  }
  if (opts.profile && !["full", "short"].includes(opts.profile))
    throw new Error("--profile must be full or short");
  if (!(opts.runs >= 1)) throw new Error("--runs must be at least 1");
  return opts;
}

const AREAS = [
  "tool-use",
  "context-use",
  "file-edits",
  "plan-edits",
  "questions",
];
const LEVELS = ["manual", "cautious", "automatic", "permissive", "yolo"];

function parseLevels(text) {
  const levels = {};
  for (const part of text.split(",")) {
    const [area, level] = part.split("=").map((s) => s?.trim().toLowerCase());
    if (!AREAS.includes(area))
      throw new Error(`--level: unknown area ${area} (${AREAS.join(", ")})`);
    if (!LEVELS.includes(level))
      throw new Error(`--level: unknown level ${level} (${LEVELS.join(", ")})`);
    levels[area] = level;
  }
  return levels;
}

// ---------------------------------------------------------------------------
// Settings and config

function budgetTokensFor(effort) {
  return { low: 1024, medium: 4096, high: 16000 }[effort];
}

/** The settings a run is made with: the row, the provider block and the flags. */
function resolveSettings(row, opts) {
  const p = row.providerDefaults;
  const effort = opts.effort ?? row.defaultEffort;
  if (effort && Array.isArray(row.efforts) && !row.efforts.includes(effort)) {
    console.warn(
      `warning: --effort ${effort} is not in the row's efforts (${row.efforts.join(", ")}); sent anyway`,
    );
  }
  return {
    provider: p.provider ?? row.provider,
    model: row.model,
    maxTokens: opts.maxTokens ?? row.maxTokens ?? p.maxTokens ?? 4000,
    contextLength:
      opts.context ?? row.contextLength ?? p.contextLength ?? 128000,
    autoCompactRatio: opts.compactRatio,
    effort: effort ?? null,
    effortField: row.effort ?? "none",
    profile: opts.profile ?? null,
    levels: opts.levels ?? {},
    apiBase: p.apiBase ?? row.apiBase,
    apiKey: p.apiKey ?? row.apiKey,
    region: p.region ?? row.region,
    awsProfile: p.profile ?? row.awsProfile,
    metricsUrl: p.metricsUrl ?? row.metricsUrl,
  };
}

/** config.yaml for one run, as an object (YAML.stringify writes it). */
function buildConfig(settings, scenario) {
  const completion = {
    contextLength: scenario.config.contextLength ?? settings.contextLength,
    maxTokens: scenario.config.maxTokens ?? settings.maxTokens,
  };
  const model = {
    name: "Bench chat",
    provider: settings.provider,
    model: settings.model,
    roles: ["chat"],
    capabilities: ["tool_use"],
    defaultCompletionOptions: completion,
  };
  if (settings.provider === "bedrock") {
    model.env = {
      region: settings.region ?? "us-east-1",
      profile: settings.awsProfile ?? process.env.AWS_PROFILE ?? "default",
    };
  } else {
    if (settings.apiBase) model.apiBase = settings.apiBase;
    model.apiKey = settings.apiKey ?? "none";
  }
  const effortNotes = [];
  if (settings.effort && settings.effort !== "default") {
    if (settings.effortField === "openai-effort") {
      model.requestOptions = {
        extraBodyProperties: { reasoning_effort: settings.effort },
      };
    } else if (settings.effortField === "bedrock-reasoning") {
      if (settings.effort === "none") {
        completion.reasoning = false;
      } else {
        completion.reasoning = true;
        completion.reasoningBudgetTokens =
          budgetTokensFor(settings.effort) ?? 4096;
        if (!budgetTokensFor(settings.effort))
          effortNotes.push(
            `effort ${settings.effort} has no budget mapping; sent as medium`,
          );
      }
    } else {
      effortNotes.push(
        `the row has no effort switch; --effort ${settings.effort} recorded only`,
      );
    }
  }
  const ratio = scenario.config.autoCompactRatio ?? settings.autoCompactRatio;
  if (ratio !== undefined)
    model.contextManagement = { autoCompactRatio: ratio };
  const config = {
    name: "bench",
    version: "1.0.0",
    schema: "v1",
    models: [model],
  };
  const perms = scenario.policy.toolPermissions;
  if (perms && Object.keys(perms).length) config.toolPermissions = perms;
  return { config, effortNotes };
}

/** Which serve flags and loop autonomy the levels pick today. */
function applyLevels(levels, scenario) {
  const serve = [
    ...(scenario.policy.serve ??
      (scenario.kind === "agent" ? ["--auto"] : ["--readonly"])),
  ];
  const applied = {};
  const toolUse = levels["tool-use"];
  if (
    toolUse === "yolo" &&
    scenario.kind === "agent" &&
    !serve.includes("--auto")
  ) {
    serve.push("--auto");
    applied["tool-use"] = "--auto";
  } else if (toolUse === "manual" && serve.includes("--auto")) {
    serve.splice(serve.indexOf("--auto"), 1);
    applied["tool-use"] = "no --auto";
  }
  let loop = scenario.loop ? { ...scenario.loop } : undefined;
  const loopLevel = levels["plan-edits"] ?? levels["questions"];
  if (loop && loopLevel) {
    loop.autonomy = {
      manual: "supervised",
      cautious: "supervised",
      automatic: "auto",
      permissive: "auto",
      yolo: "unattended",
    }[loopLevel];
    applied[levels["plan-edits"] ? "plan-edits" : "questions"] =
      `loopAutonomy ${loop.autonomy}`;
  }
  const recordedOnly = Object.keys(levels).filter((a) => !applied[a]);
  return { serve, loop, applied, recordedOnly };
}

// ---------------------------------------------------------------------------
// Seed repository

/** A deterministic pseudo log of about `tokens` tokens (4 chars per token). */
function generateLog(tokens) {
  const target = tokens * 4;
  const lines = [];
  let size = 0;
  let i = 0;
  const paths = [
    "/items",
    "/items/42",
    "/users/7/orders",
    "/health",
    "/search?q=slug",
    "/export",
  ];
  while (size < target) {
    const status = i % 37 === 0 ? 500 : i % 11 === 0 ? 404 : 200;
    const line = `2026-11-08T${String(Math.floor(i / 3600) % 24).padStart(2, "0")}:${String(Math.floor(i / 60) % 60).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}Z svc=api req=${String(i).padStart(6, "0")} method=GET path=${paths[i % paths.length]} status=${status} ms=${(i * 7919) % 400} bytes=${(i * 104729) % 9000}`;
    lines.push(line);
    size += line.length + 1;
    i++;
  }
  return lines.join("\n") + "\n";
}

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

/** Writes the scenario's seed into `dir` and makes it a git repository. */
function makeSeed(scenario, dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  copyTree(path.join(BENCH_ROOT, scenario.seed.from ?? "seed/loopsbx"), dir);
  for (const rel of scenario.seed.remove ?? [])
    fs.rmSync(path.join(dir, rel), { recursive: true, force: true });
  for (const rel of scenario.seed.mkdirs ?? [])
    fs.mkdirSync(path.join(dir, rel), { recursive: true });
  const generated = {};
  for (const [rel, spec] of Object.entries(scenario.seed.files ?? {})) {
    const file = path.join(dir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (typeof spec === "string") {
      fs.writeFileSync(file, spec);
    } else if (spec?.generate === "log") {
      const text = generateLog(spec.tokens ?? 60000);
      fs.writeFileSync(file, text);
      generated[rel] = {
        chars: text.length,
        approxTokens: Math.round(text.length / 4),
      };
    } else {
      throw new Error(`seed file ${rel}: unknown spec ${JSON.stringify(spec)}`);
    }
  }
  const git = (args) =>
    execFileSync("git", args, {
      cwd: dir,
      stdio: "pipe",
      env: {
        ...process.env,
        GIT_CONFIG_COUNT: "2",
        GIT_CONFIG_KEY_0: "user.name",
        GIT_CONFIG_VALUE_0: "bench",
        GIT_CONFIG_KEY_1: "user.email",
        GIT_CONFIG_VALUE_1: "bench@example.invalid",
      },
    });
  git(["init", "-q", "-b", "main"]);
  git(["add", "-A"]);
  git(["commit", "-q", "-m", "seed", "--no-verify"]);
  return generated;
}

// ---------------------------------------------------------------------------
// Placeholders

/** `{{outsidePath}}` and friends in prompts and expectations. */
function substitute(value, vars) {
  if (typeof value === "string") {
    return value.replace(/\{\{(\w+)\}\}/g, (m, key) =>
      key in vars ? vars[key] : m,
    );
  }
  if (Array.isArray(value)) return value.map((v) => substitute(v, vars));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, substitute(v, vars)]),
    );
  }
  return value;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------------------------------------------------------------------------
// Ports and processes

function freePort(from) {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      if (port > from + 200)
        return reject(new Error(`no free port from ${from}`));
      const srv = net.createServer();
      srv.once("error", () => tryPort(port + 1));
      srv.listen(port, "127.0.0.1", () => srv.close(() => resolve(port)));
    };
    tryPort(from);
  });
}

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    } else {
      child.kill("SIGKILL");
    }
  } catch {}
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// The provenance every record carries

function provenance(cn) {
  let commit = null;
  let dirty = null;
  try {
    commit = execSync("git rev-parse HEAD", {
      cwd: REPO_ROOT,
      encoding: "utf-8",
    }).trim();
    dirty =
      execSync("git status --porcelain", {
        cwd: REPO_ROOT,
        encoding: "utf-8",
      }).trim().length > 0;
  } catch {}
  let bundle = { path: cn, exists: fs.existsSync(cn) };
  if (bundle.exists) {
    const st = fs.statSync(cn);
    bundle = { ...bundle, mtime: st.mtime.toISOString(), size: st.size };
  }
  return {
    commit,
    dirty,
    bundle,
    node: process.version,
    platform: `${os.platform()} ${os.release()}`,
  };
}

function hashOf(...parts) {
  return createHash("sha256")
    .update(
      parts
        .map((p) => (typeof p === "string" ? p : JSON.stringify(p)))
        .join("\n"),
    )
    .digest("hex")
    .slice(0, 16);
}

// ---------------------------------------------------------------------------
// Seed checks (the expectations that need the repository)

function runSeedChecks(expectations, repo) {
  const out = [];
  for (const e of expectations) {
    if (e.check === "file-exists" || e.check === "file-missing") {
      const file = path.isAbsolute(e.path) ? e.path : path.join(repo, e.path);
      const exists = fs.existsSync(file);
      out.push({
        check: e.check,
        path: e.path,
        exists,
        pass: e.check === "file-exists" ? exists : !exists,
      });
    } else if (e.check === "command-exits-0") {
      const r = spawnSync(e.command, {
        cwd: repo,
        shell: true,
        encoding: "utf-8",
        timeout: 120_000,
      });
      out.push({
        check: e.check,
        command: e.command,
        exitCode: r.status,
        pass: r.status === 0,
        output: `${r.stdout ?? ""}${r.stderr ?? ""}`.slice(-1500),
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// One run

async function runOnce({
  scenario,
  row,
  settings,
  opts,
  runIndex,
  outDir,
  cn,
  prov,
  port,
}) {
  const runDir = path.join(
    outDir,
    slug(row.id),
    scenario.name,
    `run${runIndex}`,
  );
  fs.rmSync(runDir, { recursive: true, force: true });
  fs.mkdirSync(runDir, { recursive: true });
  const repo = path.join(runDir, "repo");
  const gdir = path.join(runDir, "gdir");
  const dumps = path.join(runDir, "requests");
  const stateDir = path.join(runDir, "state");
  fs.mkdirSync(gdir, { recursive: true });
  fs.mkdirSync(stateDir, { recursive: true });

  const generated = makeSeed(scenario, repo);
  // One character off the working directory, as the family survey's model did
  const outsidePath = `${repo}2`;
  const vars = {
    repoDir: repo,
    outsidePath,
    outsidePathRe: escapeRe(outsidePath).replace(/\\\\/g, "[/\\\\]"),
  };
  const prompt = substitute(scenario.prompt, vars);
  const expectations = substitute(scenario.expectations, vars);

  const { config, effortNotes } = buildConfig(settings, scenario);
  const configFile = path.join(runDir, "config.yaml");
  fs.writeFileSync(configFile, YAML.stringify(config));
  let permissionsFile = null;
  if (scenario.policy.permissionsYaml) {
    permissionsFile = path.join(gdir, "permissions.yaml");
    fs.writeFileSync(
      permissionsFile,
      YAML.stringify(scenario.policy.permissionsYaml),
    );
  }
  const levels = applyLevels(settings.levels, scenario);
  const serveArgs = [
    cn,
    "serve",
    "--config",
    configFile,
    "--port",
    String(port),
    "--timeout",
    "3600",
    "--verbose",
    ...levels.serve,
  ];
  const env = {
    ...process.env,
    CONTINUE_GLOBAL_DIR: gdir,
    CONTINUE_DUMP_REQUESTS: dumps,
    ...(settings.profile ? { CONTINUE_PROMPT_PROFILE: settings.profile } : {}),
    ...(settings.provider === "bedrock" &&
    settings.awsProfile &&
    !process.env.AWS_PROFILE
      ? { AWS_PROFILE: settings.awsProfile }
      : {}),
    ...(settings.provider === "bedrock" &&
    settings.region &&
    !process.env.AWS_REGION
      ? { AWS_REGION: settings.region }
      : {}),
  };
  const configHash = hashOf(
    fs.readFileSync(configFile, "utf-8"),
    permissionsFile ? fs.readFileSync(permissionsFile, "utf-8") : "",
    levels.serve,
    settings.profile ?? "",
    settings.levels,
  );

  const result = {
    // The record fields (plans/model-benchmark.md, "Scoring"); the scorer adds
    // checksPassed/checksTotal, verdicts, prohibitedActions and decisions.
    model: row.model,
    modelRow: row.id,
    provider: settings.provider,
    profile: settings.profile ?? "model-default",
    levels: settings.levels,
    levelsApplied: levels.applied,
    levelsRecordedOnly: levels.recordedOnly,
    settings: {
      maxTokens: config.models[0].defaultCompletionOptions.maxTokens,
      contextLength: config.models[0].defaultCompletionOptions.contextLength,
      autoCompactRatio:
        config.models[0].contextManagement?.autoCompactRatio ?? null,
      effort: settings.effort,
      effortField: settings.effortField,
      effortNotes,
      reasoning: config.models[0].defaultCompletionOptions.reasoning ?? null,
    },
    scenario: scenario.name,
    group: scenario.group,
    area: scenario.area ?? null,
    kind: scenario.kind,
    run: runIndex,
    outcome: null,
    turns: 0,
    nudges: { harness: 0, cli: { act: 0, finishItem: 0, presentPlan: 0 } },
    repeatsRefused: 0,
    invalidCalls: 0,
    truncations: 0,
    questions: [],
    tokens: null,
    cacheReadRatio: null,
    cost: null,
    wallSeconds: 0,
    commit: prov.commit,
    commitDirty: prov.dirty,
    bundle: prov.bundle,
    configHash,
    // Everything else the scorer reads
    serveArgs: serveArgs.slice(1),
    serveFlags: levels.serve,
    toolPermissions: scenario.policy.toolPermissions ?? null,
    permissionsYaml: scenario.policy.permissionsYaml ?? null,
    prompt,
    expectations,
    budget: scenario.budget,
    paths: {
      runDir,
      repo,
      gdir,
      dumps,
      configFile,
      permissionsFile,
      outsidePath,
      cnLog: path.join(gdir, "logs", "cn.log"),
    },
    seedGenerated: generated,
    port,
    startedAt: new Date().toISOString(),
    env: { prov },
  };

  if (opts.dryRun) {
    result.outcome = "dry-run";
    result.dryRun = {
      command: [process.execPath, ...serveArgs].join(" "),
      cwd: repo,
      env: Object.fromEntries(
        Object.entries(env).filter(([k]) => /^CONTINUE_|^AWS_/.test(k)),
      ),
    };
    writeJson(path.join(runDir, "result.json"), result);
    console.log(
      `${row.id} ${scenario.name} run${runIndex}: dry run written to ${runDir}`,
    );
    console.log(`  ${result.dryRun.command}`);
    return result;
  }

  const logFile = path.join(runDir, "harness.log");
  const log = (line) =>
    fs.appendFileSync(
      logFile,
      `[${new Date().toISOString().slice(11, 19)}] ${line}\n`,
    );
  const serveOut = fs.openSync(path.join(runDir, "serve.log"), "w");
  const started = Date.now();
  const deadline = started + scenario.budget.deadlineSeconds * 1000;
  const server = spawn(process.execPath, serveArgs, {
    cwd: repo,
    env,
    stdio: ["ignore", serveOut, serveOut],
  });
  let serveExit = null;
  server.on("exit", (code, signal) => {
    serveExit = { code, signal, at: Math.round((Date.now() - started) / 1000) };
  });
  const base = `http://127.0.0.1:${port}`;
  const post = async (body) => {
    const res = await fetch(`${base}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
  const getJson = async (url) => {
    try {
      return await (await fetch(url)).json();
    } catch (e) {
      return { error: String(e) };
    }
  };

  // Every /state read goes through here: a snapshot per history change, and
  // the budget check that ends the run when it is over.
  let snapshots = 0;
  let lastLen = -1;
  let lastState = null;
  const timeline = [];
  const budgetOf = (s) => {
    const history = s.session?.history ?? [];
    const requests = history.filter(
      (i) => i.message?.role === "assistant",
    ).length;
    const u = s.session?.usage ?? {};
    const tokens =
      (u.promptTokens ?? 0) +
      (u.completionTokens ?? 0) +
      (u.promptTokensDetails?.cachedTokens ?? 0) +
      (u.promptTokensDetails?.cacheWriteTokens ?? 0);
    return { requests, tokens };
  };
  class BudgetExceeded extends Error {}
  const state = async () => {
    const s = await (await fetch(`${base}/state`)).json();
    lastState = s;
    const len = s.session?.history?.length ?? 0;
    if (len !== lastLen) {
      lastLen = len;
      snapshots += 1;
      const last = s.session.history.at(-1);
      const compact = {
        t: Math.round((Date.now() - started) / 1000),
        historyLength: len,
        lastRole: last?.message?.role,
        lastTools: (last?.toolCallStates ?? []).map(
          (tc) => `${nameOf(tc)}:${tc.status}`,
        ),
        isProcessing: s.isProcessing,
        messageQueueLength: s.messageQueueLength,
        pendingPermission: s.pendingPermission
          ? { toolName: s.pendingPermission.toolName }
          : null,
        pendingQuestions: s.pendingQuestions ?? [],
        openQuestions: s.openQuestions ?? 0,
        promptCache: s.promptCache ?? null,
        truncatedReplies: s.truncatedReplies ?? 0,
        loop: s.loop
          ? {
              status: s.loop.status,
              round: s.loop.round,
              items: s.loop.items?.map((i) => `${i.id}:${i.status}`),
              questions: s.loop.questions?.length ?? 0,
              stopReason: s.loop.stopReason,
            }
          : null,
        loopStatus: s.loopStatus ?? null,
        usage: s.session?.usage ?? null,
      };
      writeJson(
        path.join(stateDir, `${String(snapshots).padStart(3, "0")}.json`),
        compact,
      );
      timeline.push({
        t: compact.t,
        historyLength: len,
        role: compact.lastRole,
        tools: compact.lastTools.join(","),
      });
    }
    const b = budgetOf(s);
    if (b.requests > scenario.budget.maxRequests)
      throw new BudgetExceeded(
        `requests ${b.requests} > ${scenario.budget.maxRequests}`,
      );
    if (b.tokens > scenario.budget.maxTokens)
      throw new BudgetExceeded(
        `tokens ${b.tokens} > ${scenario.budget.maxTokens}`,
      );
    if (Date.now() > deadline)
      throw new BudgetExceeded(`deadline ${scenario.budget.deadlineSeconds}s`);
    return s;
  };

  const metricsBefore = settings.metricsUrl
    ? await getJson(settings.metricsUrl)
    : null;
  const loopSpec = levels.loop;
  try {
    for (let i = 0; ; i++) {
      if (i > 120) throw new Error("serve did not start in 120 s");
      if (serveExit)
        throw new Error(
          `serve exited before it answered (code ${serveExit.code})`,
        );
      try {
        await state();
        break;
      } catch (e) {
        if (e instanceof BudgetExceeded) throw e;
        await sleep(1000);
      }
    }
    result.serveReadySeconds = Math.round((Date.now() - started) / 1000);
    const sent = await post({ message: prompt });
    log(`prompt: ${sent.status} ${JSON.stringify(sent.body).slice(0, 120)}`);

    if (scenario.kind === "agent") {
      await sleep(2000);
      for (;;) {
        const s = await state();
        if (serveExit) {
          result.serveExitedEarly = serveExit;
          break;
        }
        if (!s.isProcessing && !(s.messageQueueLength > 0)) break;
        await sleep(2000);
      }
    } else {
      // Planning: wait for PresentPlan, nudging twice at most. A held
      // AskQuestion does not wait in serve, so the loop goes on to
      // PresentPlan; a question still "calling" after 90 s is a stall.
      let seen = (await state()).session.history.length;
      let stalledSince = 0;
      for (;;) {
        const s = await state();
        if (serveExit) {
          result.serveExitedEarly = serveExit;
          break;
        }
        const calls = toolCalls(s.session.history);
        const open = calls.find(
          (tc) =>
            nameOf(tc) === "AskQuestion" &&
            !["done", "errored", "canceled"].includes(tc.status),
        );
        if (open && !s.isProcessing) {
          stalledSince ||= Date.now();
          if (Date.now() - stalledSince > 90_000) {
            log(
              `stalled on a question: ${JSON.stringify(argsOf(open)).slice(0, 200)}`,
            );
            result.stalledQuestion = true;
            break;
          }
        } else {
          stalledSince = 0;
        }
        const presented = calls.find(
          (tc) => nameOf(tc) === "PresentPlan" && tc.status === "done",
        );
        if (presented && !s.isProcessing) {
          log(
            `plan presented: ${JSON.stringify(argsOf(presented)).slice(0, 400)}`,
          );
          break;
        }
        const last = s.session.history.at(-1);
        if (
          !s.isProcessing &&
          !presented &&
          last?.message?.role === "assistant" &&
          !(last.toolCallStates ?? []).length &&
          s.session.history.length > seen
        ) {
          log(
            `no PresentPlan: ${JSON.stringify(textOf(last.message)).slice(0, 300)}`,
          );
          if (result.nudges.harness >= 2) {
            result.neverPresented = true;
            break;
          }
          result.nudges.harness += 1;
          seen = s.session.history.length + 1;
          await post({
            message:
              "Call the PresentPlan tool now with the plan. You cannot run commands while planning.",
          });
        }
        await sleep(2000);
      }
    }

    if (
      scenario.kind === "loop" &&
      !result.stalledQuestion &&
      !result.neverPresented &&
      !serveExit
    ) {
      const start = await post({ loopAction: "start" });
      log(
        `loop start: ${start.status} ${JSON.stringify(start.body.loopStatus ?? start.body.error)}`,
      );
      if (start.status !== 200) {
        result.loopStartError = start.body.error ?? start.status;
      } else {
        if (loopSpec?.autonomy)
          log(
            `autonomy ${(await post({ loopAutonomy: loopSpec.autonomy })).status}`,
          );
        if (loopSpec?.strategy)
          log(
            `strategy ${(await post({ loopStrategy: loopSpec.strategy })).status}`,
          );
        let lastStatus = "";
        const answered = new Set();
        for (;;) {
          const s = await state();
          if (serveExit) {
            result.serveExitedEarly = serveExit;
            break;
          }
          const loop = s.loop;
          if (!loop) break;
          if (s.loopStatus !== lastStatus) {
            lastStatus = s.loopStatus;
            log(`status: ${lastStatus}`);
          }
          for (const q of loop.questions ?? []) {
            if (q.answerId || answered.has(q.id)) continue;
            answered.add(q.id);
            result.questions.push({
              id: q.id,
              kind: q.kind,
              type: q.type ?? null,
              itemId: q.itemId ?? null,
              question: String(q.question ?? "").slice(0, 300),
              assumption: q.assumption?.slice(0, 200) ?? null,
              answeredBy: "harness",
            });
            log(
              `question ${q.id} [${q.kind}${q.type ? "/" + q.type : ""}] item ${q.itemId}: ${String(q.question).slice(0, 200)}`,
            );
            const answer =
              q.kind === "approval"
                ? { questionId: q.id, text: "", approve: true }
                : q.kind === "assumption"
                  ? { questionId: q.id, text: "", confirm: true }
                  : {
                      questionId: q.id,
                      text: "Use your best judgment and say what you chose.",
                    };
            await post({ loopAnswer: answer });
          }
          if (loop.status === "awaiting_plan") {
            log(`re-plan waits (${loop.replanReason}); continuing`);
            result.replansContinued = (result.replansContinued ?? 0) + 1;
            await post({ loopAction: "continue" });
          }
          if (loop.status === "stopped") {
            log(`stopped: ${loop.stopReason}: ${loop.stopDetail}`);
            break;
          }
          await sleep(2000);
        }
      }
    }
  } catch (error) {
    if (error instanceof BudgetExceeded) {
      result.killed = {
        reason: error.message,
        at: Math.round((Date.now() - started) / 1000),
      };
      log(`budget: ${error.message}; stopping the serve`);
      await fetch(`${base}/pause`, { method: "POST" }).catch(() => {});
    } else {
      result.error = String(error?.stack ?? error);
      log(`error: ${result.error}`);
    }
  }

  // What there is at the end, whatever happened
  let s = lastState;
  try {
    s = await (await fetch(`${base}/state`)).json();
  } catch {}
  if (s) {
    writeJson(path.join(runDir, "state.json"), s);
    fillFromState(result, s, row);
  }
  result.timeline = timeline;
  result.serveExit = serveExit;
  try {
    const plansDir = path.join(repo, ".continuous", "plans");
    result.planFiles = {};
    for (const f of fs.existsSync(plansDir) ? fs.readdirSync(plansDir) : []) {
      result.planFiles[f] = fs.readFileSync(path.join(plansDir, f), "utf-8");
    }
  } catch (e) {
    result.planFilesError = String(e);
  }
  try {
    result.git = execSync("git status --porcelain", {
      cwd: repo,
      encoding: "utf-8",
    });
  } catch {}

  await fetch(`${base}/exit`, { method: "POST" }).catch(() => {});
  await sleep(1500);
  killTree(server);
  await sleep(300);
  fs.closeSync(serveOut);
  result.wallSeconds = Math.round((Date.now() - started) / 1000);
  result.seedChecks = runSeedChecks(expectations, repo);
  result.requestDumps = fs.existsSync(dumps) ? fs.readdirSync(dumps).length : 0;
  result.cnLog = summariseCnLog(result.paths.cnLog);
  if (settings.metricsUrl) {
    const after = await getJson(settings.metricsUrl);
    result.strata = strataDelta(metricsBefore, after);
  }
  result.outcome = outcomeOf(result, scenario);
  writeJson(path.join(runDir, "result.json"), result);
  const cost = result.cost?.list ?? result.cost?.cli;
  console.log(
    `${row.id} ${scenario.name} run${runIndex}: ${result.outcome}${result.killed ? ` (${result.killed.reason})` : ""} ${result.wallSeconds}s, ${result.turns} turns, ${result.tokens?.in ?? 0} in / ${result.tokens?.out ?? 0} out${cost !== undefined && cost !== null ? `, $${cost.toFixed(4)}` : ""}`,
  );
  return result;
}

/** done | stuck | waiting | failed | killed, from what the run left behind. */
function outcomeOf(result, scenario) {
  if (result.killed) return "killed";
  if (result.error || result.serveExit?.code || result.turnError)
    return "failed";
  if (scenario.kind === "loop") {
    const l = result.loop;
    if (l?.stopReason === "done") return "done";
    if (l?.status === "waiting" || l?.status === "awaiting_plan")
      return "waiting";
    if (
      result.loopStartError ||
      result.neverPresented ||
      result.stalledQuestion
    )
      return "stuck";
    return l ? "stuck" : "failed";
  }
  if (scenario.kind === "plan") {
    if ((result.presentPlans ?? []).some((p) => p.status === "done"))
      return "done";
    if (result.stalledQuestion || result.pendingPermission) return "waiting";
    return "stuck";
  }
  if (result.pendingPermission) return "waiting";
  if (result.shape?.endsWithoutTools && result.turns > 0) return "done";
  return "stuck";
}

/** Lines of the CLI's own debug log that say what the harness did. */
function summariseCnLog(file) {
  if (!fs.existsSync(file)) return { missing: true };
  const lines = fs.readFileSync(file, "utf-8").split("\n");
  const pick = (re) => lines.filter((l) => re.test(l));
  const trim = (ls) =>
    ls.slice(0, 8).map((l) => l.replace(/^\S+ \[\w+\] /, "").slice(0, 220));
  const compaction = pick(/compact(ing|ed|ion)/i).filter(
    (l) => !/shouldCompact: false/.test(l),
  );
  const refusals = pick(/Refusal cap|refused|denial/i);
  const errors = pick(/\[error\]/);
  const finishReasons = {};
  for (const l of lines) {
    for (const m of l.matchAll(/"finish_reason":"([a-z_]+)"/g))
      finishReasons[m[1]] = (finishReasons[m[1]] ?? 0) + 1;
  }
  return {
    lines: lines.length,
    compaction: compaction.length,
    refusals: refusals.length,
    errors: errors.length,
    finishReasons,
    sample: {
      compaction: trim(compaction),
      refusals: trim(refusals),
      errors: trim(errors),
    },
  };
}

/** Strata's /metrics: the requests this run made, and the cache counters' movement. */
function strataDelta(before, after) {
  if (!after || after.error) return { error: after?.error ?? "no metrics" };
  const beforeIds = new Set((before?.requests ?? []).map((r) => r.id));
  const mine = (after.requests ?? []).filter((r) => !beforeIds.has(r.id));
  const sum = (k) => mine.reduce((n, r) => n + (r[k] ?? 0), 0);
  const delta = (k) =>
    (after.conversation_cache?.[k] ?? 0) -
    (before?.conversation_cache?.[k] ?? 0);
  return {
    requests: mine.map((r) => ({
      prompt_tokens: r.prompt_tokens,
      reused: r.reused,
      prompt_read: r.prompt_read,
      output_tokens: r.output_tokens,
      prompt_ms: r.prompt_ms,
      decode_ms: r.decode_ms,
      finish: r.finish,
    })),
    totals: {
      requests: mine.length,
      prompt_tokens: sum("prompt_tokens"),
      reused: sum("reused"),
      prompt_read: sum("prompt_read"),
      output_tokens: sum("output_tokens"),
    },
    conversationCache: {
      parks: delta("parks"),
      restores: delta("restores"),
      evictions: delta("evictions"),
      requests: delta("requests"),
      requests_reused: delta("requests_reused"),
    },
    windowNote:
      "the /metrics requests list is a sliding window; a long run keeps only its tail",
  };
}

// ---------------------------------------------------------------------------
// Main

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(HELP);
    return;
  }
  const matrix = loadMatrix(opts.matrix);
  if (opts.list) {
    console.log("Scenarios:");
    for (const n of listScenarios()) {
      const s = loadScenario(n);
      console.log(
        `  ${n.padEnd(26)} ${s.group.padEnd(11)} ${s.kind.padEnd(6)} ${s.what}`,
      );
    }
    console.log("Matrix rows:");
    for (const r of matrix.models)
      console.log(`  ${r.id.padEnd(18)} ${r.provider.padEnd(8)} ${r.model}`);
    return;
  }
  if (!opts.model) throw new Error(`--model is required\n\n${HELP}`);
  if (!opts.scenarios.length)
    throw new Error(`--scenarios is required\n\n${HELP}`);
  const row = findModelRow(matrix, opts.model);
  const settings = resolveSettings(row, opts);
  const all = listScenarios();
  const names = opts.scenarios.flatMap((n) => {
    if (n === "all") return all;
    if (["guidance", "compliance", "safety"].includes(n))
      return all.filter((x) => loadScenario(x).group === n);
    return [n];
  });
  const scenarios = names.map(loadScenario);
  const cn = path.resolve(
    opts.cn ?? path.join(REPO_ROOT, "extensions", "cli", "dist", "cn.js"),
  );
  if (!opts.dryRun && !fs.existsSync(cn))
    throw new Error(
      `No CLI bundle at ${cn}; build it with npm run build in extensions/cli, or pass --cn`,
    );
  const outDir = path.resolve(
    opts.out ??
      path.join(
        os.tmpdir(),
        "bench-results",
        new Date().toISOString().replace(/[:.]/g, "-"),
      ),
  );
  if (outDir.startsWith(REPO_ROOT + path.sep))
    console.warn(
      `warning: --out ${outDir} is inside the repository; results are not meant to be committed`,
    );
  fs.mkdirSync(outDir, { recursive: true });
  const prov = provenance(cn);
  writeJson(path.join(outDir, "slice.json"), {
    startedAt: new Date().toISOString(),
    model: row,
    settings,
    scenarios: names,
    runs: opts.runs,
    dryRun: opts.dryRun,
    provenance: prov,
    argv: process.argv.slice(2),
  });
  console.log(
    `${opts.dryRun ? "dry run" : "slice"}: ${row.id} (${row.model}), ${names.length} scenario(s) x ${opts.runs}, out ${outDir}`,
  );
  let port = opts.portBase;
  const results = [];
  for (const scenario of scenarios) {
    for (let runIndex = 1; runIndex <= opts.runs; runIndex++) {
      port = opts.dryRun ? port + 1 : await freePort(port + 1);
      results.push(
        await runOnce({
          scenario,
          row,
          settings,
          opts,
          runIndex,
          outDir,
          cn,
          prov,
          port,
        }),
      );
    }
  }
  const outcomes = {};
  for (const r of results) outcomes[r.outcome] = (outcomes[r.outcome] ?? 0) + 1;
  console.log(
    `done: ${JSON.stringify(outcomes)}; score with: node bench/score.mjs ${outDir}`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
