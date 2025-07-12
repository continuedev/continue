import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import ToggleSwitch from "../../components/gui/Switch";
import { ToolTip } from "../../components/gui/Tooltip";
interface ContinueFeaturesMenuProps {
  logEditingData: boolean;
  handleLogEditingDataToggle: (value: boolean) => void;
  optInNextEditFeature: boolean;
  handleOptInNextEditToggle: (value: boolean) => void;
  enableStaticContextualization: boolean;
  handleEnableStaticContextualizationToggle: (value: boolean) => void;
}

export function ContinueFeaturesMenu({
  logEditingData,
  handleLogEditingDataToggle,
  optInNextEditFeature,
  handleOptInNextEditToggle,
  enableStaticContextualization,
  handleEnableStaticContextualizationToggle,
}: ContinueFeaturesMenuProps) {
  return (
    <div className="flex w-full flex-col gap-y-4">
      <div className="my-2 text-center text-xs font-medium text-slate-400">
        🚧 INTERNAL SETTINGS 🚧
      </div>
      <div className="flex w-full flex-col gap-y-4">
        <ToggleSwitch
          isToggled={logEditingData}
          onToggle={() => handleLogEditingDataToggle(!logEditingData)}
          text="Log Editing Data"
          showIfToggled={
            <>
              <ExclamationTriangleIcon
                data-tooltip-id={`auto-accept-diffs-warning-tooltip`}
                className="h-3 w-3 text-yellow-500"
              />
              <ToolTip id={`auto-accept-diffs-warning-tooltip`}>
                {`Only turn this on if you want to log your editing processes in addition to the normal dev data. Note that this will store a lot of data.`}
              </ToolTip>
            </>
          }
        />

        <ToggleSwitch
          isToggled={optInNextEditFeature}
          onToggle={() => handleOptInNextEditToggle(!optInNextEditFeature)}
          text="Enable Next Edit Over Autocomplete"
        />

        <ToggleSwitch
          isToggled={enableStaticContextualization}
          onToggle={() =>
            handleEnableStaticContextualizationToggle(
              !enableStaticContextualization,
            )
          }
          text="Use Static Contextualization"
        />
      </div>
    </div>
  );
}
