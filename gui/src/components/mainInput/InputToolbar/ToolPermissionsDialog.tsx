import { useMemo } from "react";
import { useAppSelector } from "../../../redux/hooks";
import InfoHover from "../../InfoHover";
import ToolDropdownItem from "./ToolDropdownItem";

const ToolPermissionsDialog = () => {
  const availableTools = useAppSelector((state) => state.config.config.tools);

  // Detect duplicate tool names
  const duplicateDetection = useMemo(() => {
    const counts: Record<string, number> = {};
    availableTools.forEach((tool) => {
      if (counts[tool.function.name]) {
        counts[tool.function.name] = counts[tool.function.name] + 1;
      } else {
        counts[tool.function.name] = 1;
      }
    });
    return Object.fromEntries(
      Object.entries(counts).map(([k, v]) => [k, v > 1]),
    );
  }, [availableTools]);

  return (
    <div className="px-1">
      <div className="text-vsc-foreground mb-1 flex items-center gap-2 px-2 py-2 text-xs">
        <h2 className="m-0 p-0 text-base">Tool policies</h2>
        <InfoHover
          id={"tool-policies"}
          size={"4"}
          msg={
            <div
              className="gap-0 *:m-1 *:text-left"
              style={{ fontSize: "10px" }}
            >
              <p>
                <span className="text-green-500">Automatic:</span> Can be used
                without asking
              </p>
              <p>
                <span className="text-yellow-500">Allowed:</span> Will ask
                before using
              </p>
              <p>
                <span className="text-red-500">Disabled:</span> Cannot be used
              </p>
            </div>
          }
        />
      </div>
      <div className="max-h-72 overflow-y-auto pr-2">
        {availableTools.map((tool) => (
          <ToolDropdownItem
            key={tool.uri + tool.function.name}
            tool={tool}
            duplicatesDetected={duplicateDetection[tool.function.name]}
          />
        ))}
      </div>
    </div>
  );
};

export default ToolPermissionsDialog;
