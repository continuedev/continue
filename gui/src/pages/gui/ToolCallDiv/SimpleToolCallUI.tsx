import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { ContextItemWithId, Tool, ToolCallState } from "core";
import { ComponentType, useMemo, useState } from "react";
import { ContextItemsPeekItem } from "../../../components/mainInput/belowMainInput/ContextItemsPeek";
import { ArgsItems, ArgsToggleIcon } from "./ToolCallArgs";
import { ToolCallStatusMessage } from "./ToolCallStatusMessage";

interface SimpleToolCallUIProps {
  toolCallState: ToolCallState;
  tool: Tool | undefined;
  contextItems: ContextItemWithId[];
  icon?: ComponentType<React.SVGProps<SVGSVGElement>>;
}

export function SimpleToolCallUI({
  contextItems,
  icon: Icon,
  toolCallState,
  tool,
}: SimpleToolCallUIProps) {
  const ctxItems = useMemo(() => {
    return contextItems?.filter((ctxItem) => !ctxItem.hidden) ?? [];
  }, [contextItems]);

  const [open, setOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showingArgs, setShowingArgs] = useState(false);

  const args: [string, any][] = useMemo(() => {
    return Object.entries(toolCallState.parsedArgs);
  }, [toolCallState.parsedArgs]);

  return (
    <div className="flex flex-1 flex-col pl-1 pr-2 pt-2 hover:brightness-125">
      <div className="flex flex-row items-center justify-between gap-2">
        <div
          className="group flex cursor-pointer items-center justify-between gap-1.5 text-xs text-gray-300"
          onClick={() => setOpen((prev) => !prev)}
          data-testid="context-items-peek"
        >
          <div className="flex h-4 w-4 flex-shrink-0">
            {Icon && (
              <Icon
                className={`h-full w-full text-gray-400 group-hover:hidden ${open ? "hidden" : "block"}`}
              />
            )}
            <ChevronRightIcon
              className={`text-gray-400 transition-all duration-200 ease-in-out ${
                open
                  ? "rotate-90 opacity-0"
                  : "rotate-0 opacity-100 group-hover:block"
              } ${Icon ? "hidden group-hover:block" : "block"}`}
            />
            <ChevronDownIcon
              className={`text-gray-400 transition-all duration-200 ease-in-out ${
                open ? "rotate-0 opacity-100" : "-rotate-90 opacity-0"
              }`}
            />
          </div>
          <div
            className="flex bg-blue-200 text-xs text-gray-400 transition-colors duration-200"
            data-testid="toggle-div-title"
          >
            <ToolCallStatusMessage tool={tool} toolCallState={toolCallState} />
          </div>
        </div>

        {args.length > 0 ? (
          <ArgsToggleIcon
            isShowing={showingArgs}
            setIsShowing={setShowingArgs}
            toolCallId={toolCallState.toolCallId}
          />
        ) : null}
      </div>
      <ArgsItems args={args} isShowing={showingArgs} />
      <div
        className={`mt-2 overflow-y-auto transition-all duration-300 ease-in-out ${
          open ? "max-h-[50vh] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {ctxItems.length ? (
          ctxItems.map((contextItem, idx) => (
            <ContextItemsPeekItem key={idx} contextItem={contextItem} />
          ))
        ) : (
          <div className="pl-5 text-xs italic text-gray-400">
            No tool call output
          </div>
        )}
      </div>
    </div>
  );
}
