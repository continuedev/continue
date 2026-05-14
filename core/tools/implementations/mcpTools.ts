import { MCPServerStatus, ToolExtras } from "../..";
import { MCPManagerSingleton } from "../../context/mcp/MCPManagerSingleton";
import { ToolImpl } from ".";

type RuntimeAuthStatus = {
  name: string;
  id?: string;
  status: string;
  tools: number;
  prompts: number;
  resources: number;
  protectedResource?: boolean;
  errors?: string[];
  infos?: string[];
};

type RuntimeResource = {
  server: string;
  uri: string;
  name?: string;
};

type McpRuntimeAdapter = {
  getAuthStatuses?: (server?: string) => Promise<RuntimeAuthStatus[]>;
  listResources?: (server?: string) => Promise<RuntimeResource[]>;
  readResource?: (uri: string, server?: string) => Promise<string | null>;
};

function optionalText(value: unknown): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed : undefined;
}

function getMcpRuntimeAdapter(
  extras: ToolExtras,
): McpRuntimeAdapter | undefined {
  return (extras as any).mcpRuntime as McpRuntimeAdapter | undefined;
}

function matchesServer(status: MCPServerStatus, server?: string): boolean {
  if (!server) {
    return true;
  }

  return status.name === server || status.id === server;
}

function getMatchingStatuses(server?: string): MCPServerStatus[] {
  return MCPManagerSingleton.getInstance()
    .getStatuses()
    .filter((status) => matchesServer(status, server));
}

function formatStatusLine(status: MCPServerStatus): string {
  const toolCount = status.tools.length;
  const promptCount = status.prompts.length;
  const resourceCount = status.resources.length;
  const isProtectedResource = status.isProtectedResource;

  const errors =
    status.errors.length > 0 ? ` errors=${status.errors.join(" | ")}` : "";
  const infos =
    status.infos.length > 0 ? ` infos=${status.infos.join(" | ")}` : "";

  return `${status.name}: status=${status.status} tools=${toolCount} prompts=${promptCount} resources=${resourceCount} protected_resource=${isProtectedResource}${errors}${infos}`;
}

function formatRuntimeStatusLine(status: RuntimeAuthStatus): string {
  const errors =
    (status.errors ?? []).length > 0
      ? ` errors=${(status.errors ?? []).join(" | ")}`
      : "";
  const infos =
    (status.infos ?? []).length > 0
      ? ` infos=${(status.infos ?? []).join(" | ")}`
      : "";

  return `${status.name}: status=${status.status} tools=${status.tools} prompts=${status.prompts} resources=${status.resources} protected_resource=${status.protectedResource ?? false}${errors}${infos}`;
}

async function readResourceContents(
  extras: ToolExtras,
  uri: string,
  server?: string,
): Promise<string> {
  const statuses = getMatchingStatuses(server);
  const matches = statuses.filter((status) =>
    status.resources.some((resource) => resource.uri === uri),
  );

  if (matches.length === 0) {
    return `MCP resource not found: ${uri}`;
  }

  if (matches.length > 1) {
    return `MCP resource is ambiguous: ${uri}. Provide a server name or id.`;
  }

  const [match] = matches;
  const connection = MCPManagerSingleton.getInstance().getConnection(match.id);
  if (!connection) {
    throw new Error(`MCP connection not found: ${match.id}`);
  }

  const { contents } = await connection.getResource(uri);
  const textContents = contents
    .map((resource) =>
      "text" in resource && typeof resource.text === "string"
        ? resource.text
        : null,
    )
    .filter((text): text is string => text !== null);

  if (textContents.length === 0) {
    throw new Error("Continue currently only supports text resources from MCP");
  }

  return textContents.join("\n\n");
}

export const listMcpResourcesImpl: ToolImpl = async (args, extras) => {
  const server = optionalText(args?.server);
  const runtime = getMcpRuntimeAdapter(extras);

  if (runtime?.listResources) {
    if (runtime.getAuthStatuses) {
      const statuses = await runtime.getAuthStatuses(server);
      if (statuses.length === 0) {
        return [
          {
            name: "MCP Resources",
            description: "No matching MCP servers",
            content: server
              ? `No MCP server named ${server}.`
              : "No MCP servers configured.",
          },
        ];
      }
    }

    const resources = await runtime.listResources(server);
    return [
      {
        name: "MCP Resources",
        description: `${resources.length} resource(s)`,
        content:
          resources.length === 0
            ? "No MCP resources found."
            : resources
                .map(
                  (resource) =>
                    `${resource.server}: ${resource.uri}${resource.name ? ` (${resource.name})` : ""}`,
                )
                .join("\n"),
      },
    ];
  }

  const statuses = getMatchingStatuses(server);

  if (statuses.length === 0) {
    return [
      {
        name: "MCP Resources",
        description: "No matching MCP servers",
        content: server
          ? `No MCP server named ${server}.`
          : "No MCP servers configured.",
      },
    ];
  }

  const resources = statuses.flatMap((status) =>
    status.resources.map(
      (resource) =>
        `${status.name}: ${resource.uri}${resource.name ? ` (${resource.name})` : ""}`,
    ),
  );

  return [
    {
      name: "MCP Resources",
      description: `${resources.length} resource(s)`,
      content:
        resources.length === 0
          ? "No MCP resources found."
          : resources.join("\n"),
    },
  ];
};

export const readMcpResourceImpl: ToolImpl = async (args, extras) => {
  const uri = optionalText(args?.uri);
  if (!uri) {
    throw new Error("uri is required");
  }

  const runtime = getMcpRuntimeAdapter(extras);
  if (runtime?.readResource) {
    const resource = await runtime.readResource(
      uri,
      optionalText(args?.server),
    );
    return [
      {
        name: "MCP Resource",
        description: uri,
        content: resource ?? `MCP resource not found: ${uri}`,
      },
    ];
  }

  return [
    {
      name: "MCP Resource",
      description: uri,
      content: await readResourceContents(
        extras,
        uri,
        optionalText(args?.server),
      ),
    },
  ];
};

export const mcpAuthImpl: ToolImpl = async (args, extras) => {
  const server = optionalText(args?.server);
  const runtime = getMcpRuntimeAdapter(extras);

  if (runtime?.getAuthStatuses) {
    const statuses = await runtime.getAuthStatuses(server);
    if (statuses.length === 0) {
      return [
        {
          name: "MCP Auth",
          description: "No matching MCP servers",
          content: server
            ? `No MCP server named ${server}.`
            : "No MCP servers configured.",
        },
      ];
    }

    return [
      {
        name: "MCP Auth",
        description: `${statuses.length} server(s)`,
        content: statuses
          .map((status) => formatRuntimeStatusLine(status))
          .join("\n"),
      },
    ];
  }

  const statuses = getMatchingStatuses(server);

  if (statuses.length === 0) {
    return [
      {
        name: "MCP Auth",
        description: "No matching MCP servers",
        content: server
          ? `No MCP server named ${server}.`
          : "No MCP servers configured.",
      },
    ];
  }

  return [
    {
      name: "MCP Auth",
      description: `${statuses.length} server(s)`,
      content: statuses.map((status) => formatStatusLine(status)).join("\n"),
    },
  ];
};
