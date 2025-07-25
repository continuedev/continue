import ToggleSwitch from "../../components/gui/Switch";
interface ContinueFeaturesMenuProps {
  optInNextEditFeature: boolean;
  handleOptInNextEditToggle: (value: boolean) => void;
  enableStaticContextualization: boolean;
  handleEnableStaticContextualizationToggle: (value: boolean) => void;
}

export function ContinueFeaturesMenu({
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
