import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";

/**
 * ATRSecurityContextProvider — surfaces Agent Threat Rules (ATR) findings
 * for the current file into the chat context.
 *
 * ATR is an open-source MIT-licensed detection ruleset for AI agent threats
 * (prompt injection, MCP tool poisoning, context exfiltration, and related
 * agent-protocol attack patterns). The full ruleset is shipped via the
 * `agent-threat-rules` npm package.
 *
 * Invoke with `@atr` to scan the currently open file against the ruleset and
 * attach each HIGH/CRITICAL match as a context item so the model can see the
 * findings alongside the code. Zero network calls, zero telemetry — rules are
 * loaded locally from the optional `agent-threat-rules` dependency.
 *
 * Source: https://github.com/Agent-Threat-Rule/agent-threat-rules
 */

// Cache engine across provider invocations so rules are compiled once.
let enginePromise: Promise<unknown> | null = null;

/** Test seam: inject a pre-built engine. Call __resetEngine() to undo. */
export function __setEngine(engine: unknown): void {
  enginePromise = Promise.resolve(engine);
}

/** Test seam: simulate engine-load failure. */
export function __setEngineError(error: Error): void {
  const rejected = Promise.reject(error);
  // Attach a noop handler so Node doesn't emit an unhandled-rejection warning
  // before the provider catches it.
  rejected.catch(() => {});
  enginePromise = rejected;
}

/** Test seam: clear the cached engine. */
export function __resetEngine(): void {
  enginePromise = null;
}

async function getEngine(): Promise<any> {
  if (!enginePromise) {
    enginePromise = (async () => {
      try {
        const mod = await import("agent-threat-rules");
        const ATREngine = mod.ATREngine;
        const loadRulesFromDirectory = mod.loadRulesFromDirectory;

        // Resolve the bundled rules directory from the npm package.
        const { createRequire } = await import("node:module");
        const requireFn = createRequire(import.meta.url);
        const pkgPath = requireFn.resolve("agent-threat-rules/package.json");
        const { dirname, join } = await import("node:path");
        const rulesDir = join(dirname(pkgPath), "rules");

        const rules = await loadRulesFromDirectory(rulesDir);
        const engine = new ATREngine({ rules });
        await engine.loadRules();
        return engine;
      } catch (err) {
        throw new Error(
          "Optional dependency 'agent-threat-rules' is not installed or failed to load. " +
            "Install it with: npm install agent-threat-rules",
        );
      }
    })();
  }
  return enginePromise;
}

class ATRSecurityContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "atr",
    displayTitle: "ATR Security",
    description: "Scan current file for AI agent threats (ATR rules)",
    type: "normal",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    let engine: any;
    try {
      engine = await getEngine();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return [
        {
          description: "ATR scan (unavailable)",
          content: message,
          name: "ATR unavailable",
        },
      ];
    }

    const file = await extras.ide.getCurrentFile();
    if (!file || !file.contents) {
      return [
        {
          description: "ATR scan",
          content: "No open file to scan.",
          name: "ATR: no file",
        },
      ];
    }

    const matches: any[] = engine.evaluate({
      type: "tool_response",
      content: file.contents,
      timestamp: new Date().toISOString(),
    });

    const highSeverity = matches.filter(
      (m) =>
        m?.rule?.severity === "critical" || m?.rule?.severity === "high",
    );

    if (highSeverity.length === 0) {
      return [
        {
          description: "ATR scan — no findings",
          content: `Scanned ${file.path ?? "current file"} against ATR rules. No HIGH or CRITICAL matches.`,
          name: "ATR: clean",
        },
      ];
    }

    return highSeverity.map((m) => {
      const rule = m.rule ?? {};
      const patternsJson = Array.isArray(m.matchedPatterns)
        ? JSON.stringify(m.matchedPatterns).slice(0, 240)
        : "";
      const lines = [
        `Rule: ${rule.id ?? "unknown"} (${rule.severity ?? "unknown"})`,
        rule.title ? `Title: ${rule.title}` : "",
        rule.description ? `What it detects: ${rule.description}` : "",
        patternsJson ? `Matched patterns: ${patternsJson}` : "",
        `Source: https://github.com/Agent-Threat-Rule/agent-threat-rules`,
      ].filter(Boolean);
      return {
        description: `ATR ${rule.severity ?? "match"} — ${rule.id ?? "unknown"}`,
        content: lines.join("\n"),
        name: `ATR ${rule.severity ?? "match"}: ${rule.id ?? "unknown"}`,
      };
    });
  }
}

export default ATRSecurityContextProvider;
