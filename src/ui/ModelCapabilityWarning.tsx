import { Box, Text } from "ink";
import React from "react";

interface ModelCapabilityWarningProps {
  modelName: string;
}

const ModelCapabilityWarning: React.FC<ModelCapabilityWarningProps> = ({
  modelName,
}) => {
  return (
    <Box flexDirection="column" paddingX={0}>
      <Box flexDirection="row" alignItems="center">
        <Text color="yellow">⚠️  </Text>
        <Text color="white">Model Capability Warning</Text>
      </Box>
      <Text color="gray">
        The model "{modelName}" is not recommended for use with cn due to
        limited reasoning and tool calling capabilities
      </Text>
    </Box>
  );
};

export { ModelCapabilityWarning };
