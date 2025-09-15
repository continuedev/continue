import React, { useMemo, useState } from "react";

import { useService } from "../hooks/useService.js";
import { services } from "../services/index.js";
import type { UpdateServiceState } from "../services/types.js";
import { SERVICE_NAMES } from "../services/types.js";

import { Selector, SelectorOption } from "./Selector.js";

interface UpdateSelectorProps {
  onCancel: () => void;
}

interface UpdateOption extends SelectorOption {
  action: "run" | "toggle-auto" | "back";
}

export const UpdateSelector: React.FC<UpdateSelectorProps> = ({ onCancel }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const updateServiceState = useService<UpdateServiceState>(
    SERVICE_NAMES.UPDATE,
  );

  const updateState = updateServiceState.value;

  const isWorking =
    updateServiceState.state === "loading" ||
    updateState?.status === "checking" ||
    updateState?.status === "updating";

  const error: string | null = useMemo(() => {
    if (updateServiceState.state === "error") {
      return updateServiceState.error?.message || "Update service error";
    }
    if (updateState?.status === "error") {
      return updateState.message || "Update failed";
    }
    return null;
  }, [updateServiceState.state, updateServiceState.error, updateState]);

  const loadingMessage = useMemo(() => {
    if (!updateState) return "Preparing update...";
    return updateState.message || "Working...";
  }, [updateState]);

  const options: UpdateOption[] = useMemo(() => {
    const runLabel = updateState?.latestVersion
      ? `Run update to v${updateState.latestVersion}`
      : "Run update";

    const autoUpdateLabel = updateState?.autoUpdate
      ? "Turn off auto-updates"
      : "Turn on auto-updates";

    return [
      { id: "run-update", name: runLabel, action: "run" },
      { id: "toggle-auto", name: autoUpdateLabel, action: "toggle-auto" },
      { id: "back", name: "Back", action: "back" },
    ];
  }, [updateState?.latestVersion, updateState?.autoUpdate]);

  const handleSelect = async (option: UpdateOption) => {
    switch (option.action) {
      case "run":
        // Perform a manual update (not auto-update)
        await services.updateService.performUpdate(false);
        return; // Keep selector open to show status changes
      case "toggle-auto":
        // Toggle auto-update setting
        const newValue = !updateState?.autoUpdate;
        await services.updateService.setAutoUpdate(newValue);
        return; // Keep selector open to show updated label
      case "back":
        onCancel();
        return;
    }
  };

  return (
    <Selector
      title="Update Continue CLI"
      options={options}
      selectedIndex={selectedIndex}
      loading={!!isWorking}
      error={error}
      loadingMessage={loadingMessage}
      currentId={null}
      onSelect={handleSelect}
      onCancel={onCancel}
      onNavigate={setSelectedIndex}
    />
  );
};
