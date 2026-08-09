import { ModelRole } from "@continuedev/config-yaml";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { ModelDescription } from "core";
import { ReactNode } from "react";
import { ToolTip } from "../../../components/gui/Tooltip";
import { Button } from "../../../components/ui";
import ModelRoleSelector from "./ModelRoleSelector";

interface ModelRoleRowProps {
  role: ModelRole;
  displayName: string;
  description: string | ReactNode;
  models: ModelDescription[];
  selectedModel: ModelDescription | undefined;
  onSelect: (model: ModelDescription | null) => void;
  onConfigure: (model: ModelDescription | null) => void;
  setupURL: string;
  shortcut?: ReactNode;
}

export function ModelRoleRow({
  role,
  displayName,
  description,
  models,
  selectedModel,
  onSelect,
  onConfigure,
  setupURL,
  shortcut,
}: ModelRoleRowProps) {
  return (
    <div className="py-6 first:pt-0 last:pb-0">
      <div className="mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base font-medium">{displayName}</span>
          {shortcut && shortcut}
        </div>
        <p className="text-description mt-1 text-xs">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <ModelRoleSelector
            displayName={displayName}
            description={description}
            models={models}
            selectedModel={selectedModel ?? null}
            onSelect={onSelect}
            setupURL={setupURL}
            hideTitle={true}
          />
        </div>
        {selectedModel && (
          <ToolTip content="Configure">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onConfigure(selectedModel)}
              className="text-description hover:enabled:text-foreground my-0 h-6 w-6 p-0"
            >
              <Cog6ToothIcon className="h-4 w-4 flex-shrink-0" />
            </Button>
          </ToolTip>
        )}
      </div>
    </div>
  );
}
