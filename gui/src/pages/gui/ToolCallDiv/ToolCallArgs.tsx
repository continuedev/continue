import { CodeBracketIcon } from "@heroicons/react/24/outline";
import { ToolbarButtonWithTooltip } from "../../../components/StyledMarkdownPreview/StepContainerPreToolbar/ToolbarButtonWithTooltip";

interface ArgsToggleIconProps {
  isShowing: boolean;
  setIsShowing: (val: boolean) => void;
}

export const ArgsToggleIcon = ({
  isShowing,
  setIsShowing,
}: ArgsToggleIconProps) => {
  return (
    <ToolbarButtonWithTooltip
      tooltipContent={isShowing ? "Hide args" : "Show args"}
      onClick={() => {
        setIsShowing(!isShowing);
      }}
    >
      <CodeBracketIcon className="h-3 w-3 flex-shrink-0 opacity-60" />
    </ToolbarButtonWithTooltip>
  );
};

interface ArgsItemsProps {
  isShowing: boolean;
  args: [string, string][];
}

export const ArgsItems = ({ args, isShowing }: ArgsItemsProps) => {
  if (args.length === 0) {
    return null;
  }

  if (!isShowing) {
    return null;
  }

  return (
    <div className="ml-5 mr-2 mt-1 flex flex-col text-xs">
      {args.map(([key, value]) => (
        <div key={key} className="flex flex-row items-center gap-2 py-0.5">
          <span className="text-lightgray">{key}:</span>
          <code className="break-all">{JSON.stringify(value)}</code>
        </div>
      ))}
    </div>
  );
};
