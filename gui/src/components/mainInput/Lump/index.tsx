import { useLump } from "./LumpContext";
import { LumpToolbar } from "./LumpToolbar/LumpToolbar";
import { SelectedSection } from "./sections/SelectedSection";

/**
 * Internal component that consumes the LumpContext
 */
export function Lump() {
  const { isLumpVisible, selectedSection } = useLump();

  return (
    <div className="bg-input rounded-t-default border-command-border mx-1.5 border-l border-r border-t">
      <div className="xs:px-2 px-1 py-0.5">
        <LumpToolbar />

        <div
          className={`no-scrollbar overflow-y-auto pr-0.5 transition-all duration-300 ease-in-out ${
            selectedSection
              ? "my-1 max-h-[200px] opacity-100"
              : "my-0 max-h-0 opacity-0"
          } ${isLumpVisible ? "opacity-100" : "opacity-0"}`}
        >
          <SelectedSection />
        </div>
      </div>
    </div>
  );
}
