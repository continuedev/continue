import { render } from "ink";
import React from "react";

import { getAccessToken, loadAuthConfig } from "../auth/workos.js";
import { env } from "../env.js";
import { Agent, AgentSelector } from "../ui/AgentSelector.js";
import { logger } from "../util/logger.js";

import { canAccessAgents, remote } from "./remote.js";

interface ListAgentsOptions {
  format?: "json";
}

/**
 * List available agents and allow selection
 */
export async function listAgentsCommand(
  options: ListAgentsOptions = {},
): Promise<void> {
  // Check if user has access to agents feature
  if (!(await canAccessAgents())) {
    console.error("You don't have access to the agents feature.");
    process.exit(1);
  }

  try {
    const authConfig = loadAuthConfig();
    const accessToken = getAccessToken(authConfig);

    if (!accessToken) {
      console.error("Not authenticated. Please run 'cn login' first.");
      process.exit(1);
    }

    // Fetch agents from the API
    const response = await fetch(new URL("agents/devboxes", env.apiBase), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch agents: ${response.status} ${errorText}`,
      );
    }

    const agents: Agent[] = await response.json();

    // Handle JSON format output
    if (options.format === "json") {
      console.log(
        JSON.stringify(
          {
            agents: agents.map((agent) => ({
              id: agent.id,
              name: agent.name,
              description: agent.description,
              slug: agent.slug,
              createdAt: agent.createdAt,
            })),
          },
          null,
          2,
        ),
      );
      return;
    }

    // Handle empty agents case
    if (agents.length === 0) {
      console.log("No agents found.");
      return;
    }

    // Start TUI selector
    return new Promise<void>((resolve, reject) => {
      const handleSelect = async (agentSlug: string) => {
        try {
          app.unmount();

          logger.info(`Starting remote session with agent: ${agentSlug}`);

          // Create a remote environment with the selected agent
          // We pass the agent slug as part of the prompt for now
          // This will need to be modified once the API supports agent selection
          const agentPrompt = `Agent: ${agentSlug}`;

          await remote(agentPrompt, {
            // Add any specific options for agent-based remote sessions
          });

          resolve();
        } catch (error) {
          logger.error("Error starting remote session with agent:", error);
          reject(error);
        }
      };

      const handleExit = () => {
        app.unmount();
        resolve();
      };

      const app = render(
        React.createElement(AgentSelector, {
          agents,
          onSelect: handleSelect,
          onExit: handleExit,
        }),
      );
    });
  } catch (error: any) {
    logger.error(`Failed to fetch agents: ${error.message}`);
    console.error(`Failed to fetch agents: ${error.message}`);
    process.exit(1);
  }
}
