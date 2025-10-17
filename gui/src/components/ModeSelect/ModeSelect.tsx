import { useAppSelector } from "../../redux/hooks";
import { ModeIcon } from "./ModeIcon";

export function ModeSelect() {
  const mode = useAppSelector((store) => store.session.mode);

  // Since we only have one mode (AWS SDK Expert), display it as a static label
  return (
    <div
      data-testid="mode-select-button"
      className="xs:px-2 text-description bg-lightgray/20 flex items-center gap-1 rounded-full border-none px-1.5 py-0.5"
    >
      <ModeIcon mode={mode} />
      <span className="hidden sm:block">AWS SDK Expert</span>
    </div>
  );
}
