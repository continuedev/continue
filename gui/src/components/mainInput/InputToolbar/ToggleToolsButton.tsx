import { Listbox } from "@headlessui/react";
import {
  EllipsisHorizontalCircleIcon as EllipsisHorizontalIcon,
  WrenchScrewdriverIcon as WrenchScrewdriverIconOutline,
} from "@heroicons/react/24/outline";
import { WrenchScrewdriverIcon as WrenchScrewdriverIconSolid } from "@heroicons/react/24/solid";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { lightGray, vscForeground } from "../..";
import { useAppSelector } from "../../../redux/hooks";
import { selectIsInEditMode } from "../../../redux/slices/sessionSlice";
import { toggleUseTools } from "../../../redux/slices/uiSlice";
import { ToolTip } from "../../gui/Tooltip";
import InfoHover from "../../InfoHover";
import HoverItem from "./HoverItem";
import PopoverTransition from "./PopoverTransition";
import ToolDropdownItem from "./ToolDropdownItem";

interface ToolDropdownProps {
  disabled: boolean;
}

export default function ToolDropdown(props: ToolDropdownProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dispatch = useDispatch();
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const useTools = useAppSelector((state) => state.ui.useTools);
  const availableTools = useAppSelector((state) => state.config.config.tools);
  const [showAbove, setShowAbove] = useState(false);
  const isInEditMode = useAppSelector(selectIsInEditMode);

  const ToolsIcon = useTools
    ? WrenchScrewdriverIconSolid
    : WrenchScrewdriverIconOutline;

  useEffect(() => {
    const checkPosition = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const spaceBelow = windowHeight - rect.bottom;
        setShowAbove(spaceBelow < 250);
      }
    };

    if (isDropdownOpen) {
      checkPosition();
    }
  }, [isDropdownOpen]);

  const tools = useAppSelector((store) => store.config.config.tools);

  // Detect duplicate tool names
  const duplicateDetection = useMemo(() => {
    const counts: Record<string, number> = {};
    tools.forEach((tool) => {
      if (counts[tool.function.name]) {
        counts[tool.function.name] = counts[tool.function.name] + 1;
      } else {
        counts[tool.function.name] = 1;
      }
    });
    return Object.fromEntries(
      Object.entries(counts).map(([k, v]) => [k, v > 1]),
    );
  }, [tools]);

  const isDisabled = props.disabled || isInEditMode;

  return (
    <HoverItem onClick={() => !isDisabled && dispatch(toggleUseTools())}>
      <div
        data-tooltip-id="tools-tooltip"
        className={`-ml-1 -mt-1 flex flex-row items-center gap-1.5 rounded-md px-1 py-0.5 text-xs ${
          (useTools || isHovered) && !isDisabled ? "bg-lightgray/30" : ""
        } ${isDisabled ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <ToolsIcon
          className={`h-4 w-4 text-gray-400 ${
            isDisabled ? "cursor-not-allowed" : ""
          }`}
          onMouseEnter={() => !isDisabled && setIsHovered(true)}
          onMouseLeave={() => !isDisabled && setIsHovered(false)}
        />
        {isDisabled && (
          <ToolTip id="tools-tooltip" place="top-middle">
            {isInEditMode
              ? "Tool use not supported in edit mode"
              : "This model does not support tool use"}
          </ToolTip>
        )}
        {!useTools && !isDisabled && (
          <ToolTip id="tools-tooltip" place="top-middle">
            Enable tool usage
          </ToolTip>
        )}

        {useTools && !isDisabled && (
          <>
            <span className="hidden align-top sm:flex">Tools</span>

            <div className="relative">
              <Listbox
                value={null}
                onChange={() => {}}
                as="div"
                onClick={(e) => e.stopPropagation()}
                disabled={isDisabled}
              >
                {({ open }) => (
                  <>
                    <Listbox.Button
                      ref={buttonRef}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDropdownOpen(!isDropdownOpen);
                      }}
                      className="text-lightgray flex cursor-pointer items-center border-none bg-transparent px-0 outline-none"
                      aria-disabled={isDisabled}
                    >
                      <EllipsisHorizontalIcon className="h-3 w-3 cursor-pointer hover:brightness-125" />
                    </Listbox.Button>
                    <PopoverTransition
                      show={open}
                      afterLeave={() => setDropdownOpen(false)}
                    >
                      <Listbox.Options
                        className={`bg-vsc-editor-background border-lightgray/50 absolute -left-32 z-50 mb-1 min-w-fit whitespace-nowrap rounded-md border border-solid px-1 py-0 shadow-lg ${showAbove ? "bottom-full" : ""}`}
                        static
                      >
                        <div className="sticky">
                          <div
                            className="mb-1 flex items-center gap-2 px-2 py-1 text-xs"
                            style={{
                              color: vscForeground,
                              borderBottom: `1px solid ${lightGray}`,
                            }}
                          >
                            Tool policies{" "}
                            <InfoHover
                              id={"tool-policies"}
                              size={"3"}
                              msg={
                                <div
                                  className="gap-0 *:m-1 *:text-left"
                                  style={{ fontSize: "10px" }}
                                >
                                  <p>
                                    <span className="text-green-500">
                                      Automatic:
                                    </span>{" "}
                                    Can be used without asking
                                  </p>
                                  <p>
                                    <span className="text-yellow-500">
                                      Allowed:
                                    </span>{" "}
                                    Will ask before using
                                  </p>
                                  <p>
                                    <span className="text-red-500">
                                      Disabled:
                                    </span>{" "}
                                    Cannot be used
                                  </p>
                                </div>
                              }
                            />
                          </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto overflow-x-hidden pr-2">
                          {availableTools.map((tool) => (
                            <Listbox.Option
                              key={tool.function.name}
                              value="addAllFiles"
                              className="text-vsc-foreground block w-full cursor-pointer text-left text-xs brightness-75 hover:brightness-125"
                            >
                              <ToolDropdownItem
                                tool={tool}
                                duplicatesDetected={
                                  duplicateDetection[tool.function.name]
                                }
                              />
                            </Listbox.Option>
                          ))}
                        </div>
                      </Listbox.Options>
                    </PopoverTransition>
                  </>
                )}
              </Listbox>
            </div>
          </>
        )}
      </div>
    </HoverItem>
  );
}
