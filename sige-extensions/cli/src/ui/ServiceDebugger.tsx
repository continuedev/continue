import { Box, Text } from "ink";
import React from "react";

import {
  ApiClientServiceState,
  AuthServiceState,
  ConfigServiceState,
  MCPServiceState,
  ModelServiceState,
} from "../services/types.js";

import { defaultBoxStyles } from "./styles.js";

interface ServiceDebuggerProps {
  services: {
    auth?: AuthServiceState;
    config?: ConfigServiceState;
    model?: ModelServiceState;
    mcp?: MCPServiceState;
    apiClient?: ApiClientServiceState;
  };
  loading: boolean;
  error: any;
  allReady: boolean;
  servicesLoading: boolean;
  servicesError: any;
}

const ServiceDebugger: React.FC<ServiceDebuggerProps> = ({
  services,
  loading,
  error,
  allReady,
  servicesLoading,
  servicesError,
}) => {
  const getServiceStatus = (serviceName: string, service: any) => {
    if (!service) return "❌ Not loaded";
    if (service.error) return `❌ Error: ${service.error}`;
    return "✅ Ready";
  };

  const getServiceDetails = (serviceName: string, service: any) => {
    switch (serviceName) {
      case "auth":
        return service?.authConfig
          ? `User: ${service.authConfig.email || "unknown"}`
          : "No auth config";
      case "config":
        return service?.config ? `Config: ${service.config.name}` : "No config";
      case "model":
        return service?.model ? `Model: ${service.model.name}` : "No model";
      case "mcp":
        return service?.mcpService
          ? `Tools: ${service.mcpService.getTools()?.length || 0}`
          : "No MCP service";
      case "apiClient":
        return service?.apiClient ? "API client ready" : "No API client";
      default:
        return "";
    }
  };

  return (
    <Box {...defaultBoxStyles("cyan")}>
      <Text bold color="cyan">
        🔧 Service Debug Info
      </Text>
      <Text> </Text>

      <Text color="yellow">Overall Status:</Text>
      <Text>Loading: {loading ? "🟡 Yes" : "✅ No"}</Text>
      <Text>All Ready: {allReady ? "✅ Yes" : "❌ No"}</Text>
      <Text>Services Loading: {servicesLoading ? "🟡 Yes" : "✅ No"}</Text>

      {error && <Text color="red">Error: {String(error)}</Text>}

      {servicesError && (
        <Text color="red">Services Error: {String(servicesError)}</Text>
      )}

      <Text> </Text>
      <Text color="yellow">Individual Services:</Text>

      {["auth", "config", "model", "mcp", "apiClient"].map((serviceName) => {
        const service = services[serviceName as keyof typeof services];
        const status = getServiceStatus(serviceName, service);
        const details = getServiceDetails(serviceName, service);

        return (
          <Box key={serviceName} flexDirection="column" marginLeft={2}>
            <Text>
              <Text color="white">{serviceName}:</Text> {status}
            </Text>
            {details && (
              <Box marginLeft={2}>
                <Text color="gray">{details}</Text>
              </Box>
            )}
          </Box>
        );
      })}

      <Text> </Text>
      <Text color="yellow">Intro Message Conditions:</Text>
      <Text>Services ready: {allReady ? "✅" : "❌"}</Text>
      <Text>Has config: {services.config?.config ? "✅" : "❌"}</Text>
      <Text>Has model: {services.model?.model ? "✅" : "❌"}</Text>
      <Text>Has MCP service: {services.mcp?.mcpService ? "✅" : "❌"}</Text>

      <Text> </Text>
      <Text color="gray" italic>
        Comment out this component when debugging is complete
      </Text>
    </Box>
  );
};

export { ServiceDebugger };
