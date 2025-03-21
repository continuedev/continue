import { useAppSelector } from "../../../../redux/hooks";
import { getFontSize } from "../../../../util";
import ToolDropdownItem from "../../InputToolbar/ToolDropdownItem";

interface ToolsSectionProps {}

export function ToolsSection({}: ToolsSectionProps) {
  const availableTools = useAppSelector((state) => state.config.config.tools);

  return (
    <div className="overflow-y-auto overflow-x-hidden pr-2">
      {availableTools.map((tool: any) => (
        <div
          key={tool.function.name}
          style={{
            fontSize: `${getFontSize() - 3}px`,
          }}
          className="text-vsc-foreground block w-full text-left brightness-75 hover:brightness-125"
        >
          <ToolDropdownItem tool={tool} />
        </div>
      ))}
    </div>
  );
}
