import type { ContinueConfig } from "core";
import type { ConfigHandler } from "core/config/ConfigHandler";
import * as vscode from "vscode";

import { registerAgentSessions } from "./agentSessions";
import {
  ContinuedLanguageModelChatProvider,
  LM_VENDOR,
} from "./languageModelChatProvider";
import {
  ContinuedMcpServerDefinitionProvider,
  MCP_PROVIDER_ID,
} from "./mcpServerDefinitionProvider";

const SHARE_MODELS = "continue.shareModelsWithVSCode";
const SHARE_MCP = "continue.shareMcpServersWithVSCode";

/**
 * Offer the selected Continued config's chat models and MCP servers to VS
 * Code's own chat and agents, through the stable language model and MCP
 * provider APIs. Each can be turned off in settings.
 */
export function registerVsCodeAi(
  context: vscode.ExtensionContext,
  configHandler: ConfigHandler,
) {
  const models = new ContinuedLanguageModelChatProvider();
  const mcp = new ContinuedMcpServerDefinitionProvider();
  context.subscriptions.push(models, mcp);

  const lm = vscode.lm as Partial<typeof vscode.lm> | undefined;
  try {
    if (lm?.registerLanguageModelChatProvider) {
      context.subscriptions.push(
        lm.registerLanguageModelChatProvider(LM_VENDOR, models),
      );
    }
    if (lm?.registerMcpServerDefinitionProvider) {
      context.subscriptions.push(
        lm.registerMcpServerDefinitionProvider(MCP_PROVIDER_ID, mcp),
      );
    }
  } catch (e) {
    // An editor without these APIs (some VS Code forks) keeps working.
    console.warn("Continued: could not register with VS Code AI APIs", e);
  }

  const applySettings = () => {
    const settings = vscode.workspace.getConfiguration();
    models.setEnabled(settings.get<boolean>(SHARE_MODELS, true));
    mcp.setEnabled(settings.get<boolean>(SHARE_MCP, true));
  };
  applySettings();
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration(SHARE_MODELS) ||
        e.affectsConfiguration(SHARE_MCP)
      ) {
        applySettings();
      }
    }),
  );

  const apply = (config: ContinueConfig | undefined) => {
    models.update(config?.modelsByRole?.chat);
    mcp.update(config?.mcpServerStatuses);
  };
  void configHandler.loadConfig().then(({ config }) => apply(config));
  configHandler.onConfigUpdate(({ config }) => apply(config));

  // Only in the "agents" build with the proposed API enabled; else a no-op.
  const agentSessions = registerAgentSessions(context, configHandler);

  return { models, mcp, agentSessions };
}
