import { Box, Text } from "ink";
import React, { useMemo } from "react";

import { useServices } from "../hooks/useService.js";
import {
  SERVICE_NAMES,
  UpdateServiceState,
  UpdateStatus,
} from "../services/types.js";

import { useTerminalSize } from "./hooks/useTerminalSize.js";
import { LoadingAnimation } from "./LoadingAnimation.js";

interface UpdateNotificationProps {
  isRemoteMode?: boolean;
}
const UpdateNotification: React.FC<UpdateNotificationProps> = ({
  isRemoteMode = false,
}) => {
  const { columns } = useTerminalSize();

  const { services } = useServices<{
    update: UpdateServiceState;
  }>([SERVICE_NAMES.UPDATE]);

  const color = useMemo(() => {
    switch (services.update?.status) {
      case UpdateStatus.UPDATING:
      case UpdateStatus.CHECKING:
        return "yellow";
      case UpdateStatus.UPDATED:
        return "green";
      case UpdateStatus.ERROR:
        return "red";
      default:
        return "dim";
    }
  }, [services.update?.status]);

  const text = useMemo(() => {
    if (!services.update?.message) {
      return "Continue CLI";
    }

    return services.update.message;
  }, [columns, services.update?.message]);

  if (!services.update?.isUpdateAvailable && isRemoteMode) {
    return <Text color="cyan">◉ Remote Mode</Text>;
  }

  if (services.update?.status === UpdateStatus.UPDATING) {
    return (
      <Box columnGap={1}>
        <LoadingAnimation />
        <Text color={color}>{`${text}`}</Text>
      </Box>
    );
  }

  return <Text color={color}>{`◉ ${text}`}</Text>;
};

export { UpdateNotification };
