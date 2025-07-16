import ToggleSwitch from "../../components/gui/Switch";
interface ContinueFeaturesMenuProps {
  logEditingData: boolean;
  handleLogEditingDataToggle: (value: boolean) => void;
  optInNextEditFeature: boolean;
  handleOptInNextEditToggle: (value: boolean) => void;
}

export function ContinueFeaturesMenu({
  logEditingData,
  handleLogEditingDataToggle,
  optInNextEditFeature,
  handleOptInNextEditToggle,
}: ContinueFeaturesMenuProps) {
  return (
    <div className="flex w-full flex-col gap-y-4">
      <div className="my-2 text-center text-xs font-medium text-slate-400">
        🚧 INTERNAL SETTINGS 🚧
      </div>
      <div className="flex w-full flex-col gap-y-4">
        <ToggleSwitch
          isToggled={optInNextEditFeature}
          onToggle={() => handleOptInNextEditToggle(!optInNextEditFeature)}
          text="Enable Next Edit Over Autocomplete"
        />
      </div>
    </div>
  );
}
