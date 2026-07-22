import * as fs from "fs";
import * as path from "path";

import {
  claudeCodeLikeConfigFileSchema,
  claudeDesktopLikeConfigFileSchema,
  convertJsonMcpConfigToYamlMcpConfig,
  type McpJsonConfig,
  mcpServersJsonSchema,
} from "@continuedev/config-yaml";

import { env } from "../env.js";
import { getErrorString } from "../util/error.js";
import { logger } from "../util/logger.js";

import { MCPServerConfig } from "./types.js";

const MCP_SERVERS_DIRNAME = "mcpServers";

interface NamedMcpJsonConfig {
  name: string;
  mcpJson: McpJsonConfig;
}

// Workspace `.continue/mcpServers` and the global `~/.continue/mcpServers`,
// matching where the IDE extensions look for standalone MCP server files.
function getMcpServerDirs(cwd: string): string[] {
  return [
    path.join(cwd, ".continue", MCP_SERVERS_DIRNAME),
    path.join(env.continueHome, MCP_SERVERS_DIRNAME),
  ];
}

// A file may hold a single server, a Claude-desktop-style `{ mcpServers: {...} }`
// map, or a Claude-code-style file with top-level and per-project servers.
function parseMcpServerFile(
  content: string,
  fileName: string,
): NamedMcpJsonConfig[] {
  const json = JSON.parse(content);

  const claudeCode = claudeCodeLikeConfigFileSchema.safeParse(json);
  if (claudeCode.success) {
    const records = [
      claudeCode.data.mcpServers,
      ...Object.values(claudeCode.data.projects).map((p) => p.mcpServers),
    ];
    return records
      .filter((record): record is NonNullable<typeof record> => !!record)
      .flatMap((record) =>
        Object.entries(record).map(([name, mcpJson]) => ({ name, mcpJson })),
      );
  }

  const claudeDesktop = claudeDesktopLikeConfigFileSchema.safeParse(json);
  if (claudeDesktop.success) {
    return Object.entries(claudeDesktop.data.mcpServers).map(
      ([name, mcpJson]) => ({ name, mcpJson }),
    );
  }

  const single = mcpServersJsonSchema.safeParse(json);
  if (single.success) {
    return [{ name: fileName.replace(/\.json$/, ""), mcpJson: single.data }];
  }

  throw new Error("file does not match a supported MCP JSON config format");
}

/**
 * Discover MCP servers defined as standalone JSON files in `.continue/mcpServers`
 * (workspace and global), bringing the CLI to parity with the IDE extensions.
 * Returns configs in the same shape as the rest of the assistant's mcpServers.
 */
export function loadJsonMcpServers(
  cwd: string = process.cwd(),
): MCPServerConfig[] {
  const servers: MCPServerConfig[] = [];
  const seenNames = new Set<string>();

  for (const dir of getMcpServerDirs(cwd)) {
    let fileNames: string[];
    try {
      if (!fs.existsSync(dir)) {
        continue;
      }
      fileNames = fs
        .readdirSync(dir)
        .filter((fileName) => fileName.endsWith(".json"))
        .sort();
    } catch (e) {
      logger.warn(
        `Failed to read MCP servers directory ${dir}: ${getErrorString(e)}`,
      );
      continue;
    }

    for (const fileName of fileNames) {
      const filePath = path.join(dir, fileName);
      let parsed: NamedMcpJsonConfig[];
      try {
        parsed = parseMcpServerFile(
          fs.readFileSync(filePath, "utf-8"),
          fileName,
        );
      } catch (e) {
        logger.warn(
          `Skipping invalid MCP server file ${filePath}: ${getErrorString(e)}`,
        );
        continue;
      }

      for (const { name, mcpJson } of parsed) {
        if (seenNames.has(name)) {
          continue;
        }
        try {
          const { yamlConfig } = convertJsonMcpConfigToYamlMcpConfig(
            name,
            mcpJson,
          );
          servers.push(yamlConfig as MCPServerConfig);
          seenNames.add(name);
        } catch (e) {
          logger.warn(
            `Failed to load MCP server "${name}" from ${filePath}: ${getErrorString(e)}`,
          );
        }
      }
    }
  }

  return servers;
}
