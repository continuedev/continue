import { useAppSelector } from "../../../../../redux/hooks";

export const McpSectionTooltip = () => {
  const mcpServers = useAppSelector(
    (store) => store.config.config.mcpServerStatuses,
  );

  const numServers = mcpServers.length;
  const numActiveServers = mcpServers.filter(
    (server) => server.status === "connected",
  ).length;

  return (
    <div>
      <span>{`MCP Servers (${numActiveServers}/${numServers} active)`}</span>
    </div>
  );
};
