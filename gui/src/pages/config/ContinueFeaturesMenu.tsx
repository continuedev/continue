import ToggleSwitch from "../../components/gui/Switch";
interface ContinueFeaturesMenuProps {
  optInNextEditFeature: boolean;
  handleOptInNextEditToggle: (value: boolean) => void;
}

export function ContinueFeaturesMenu({
  optInNextEditFeature,
  handleOptInNextEditToggle,
}: ContinueFeaturesMenuProps) {
  return (
    <div className="flex w-full flex-col gap-y-4">
      <div className="my-2 text-center text-xs font-medium text-slate-400">
        🚧 INTERNAL SETTINGS 🚧
      </div>
      <div className="w-full">
        <ToggleSwitch
          isToggled={optInNextEditFeature}
          onToggle={() => handleOptInNextEditToggle(!optInNextEditFeature)}
          text="Enable Next Edit Over Autocomplete"
        />
      </div>
    </div>
  );
}
