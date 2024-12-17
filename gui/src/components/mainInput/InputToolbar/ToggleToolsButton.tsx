import { Listbox, Transition } from "@headlessui/react";
import {
  EllipsisHorizontalCircleIcon as EllipsisHorizontalIcon,
  WrenchScrewdriverIcon as WrenchScrewdriverIconOutline,
} from "@heroicons/react/24/outline";
import { WrenchScrewdriverIcon as WrenchScrewdriverIconSolid } from "@heroicons/react/24/solid";
import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import styled from "styled-components";
import { defaultBorderRadius, lightGray, vscForeground } from "../..";
import { toggleUseTools } from "../../../redux/slices/uiSlice";
import { getFontSize } from "../../../util";
import InfoHover from "../../InfoHover";
import HoverItem from "./HoverItem";
import ToolDropdownItem from "./ToolDropdownItem";
import { useAppSelector } from "../../../redux/hooks";
import { ToolTip } from "../../gui/Tooltip";

export default function ToolDropdown() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dispatch = useDispatch();
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const useTools = useAppSelector((state) => state.ui.useTools);
  const availableTools = useAppSelector((state) => state.config.config.tools);
  const [showAbove, setShowAbove] = useState(false);

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

  return (
    <HoverItem onClick={() => dispatch(toggleUseTools())}>
      <div
        data-tooltip-id="tools-tooltip"
        className={`-ml-1 -mt-1 flex flex-row items-center gap-1.5 rounded-md px-1 py-0.5 text-xs ${
          useTools || isHovered ? "bg-lightgray/30" : ""
        }`}
      >
        <ToolsIcon
          className="h-4 w-4 text-gray-400"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        />
        {!useTools && (
          <ToolTip id="tools-tooltip" place="top-middle">
            Enable tool usage
          </ToolTip>
        )}

        {useTools && (
          <>
            <span className="hidden align-top sm:flex">Tools</span>

            <div className="relative">
              <Listbox
                value={null}
                onChange={() => {}}
                as="div"
                onClick={(e) => e.stopPropagation()}
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
                    >
                      <EllipsisHorizontalIcon className="h-3 w-3 cursor-pointer hover:brightness-125" />
                    </Listbox.Button>
                    <Transition
                      show={open}
                      enter="transition duration-100 ease-out"
                      enterFrom="transform scale-95 opacity-0"
                      enterTo="transform scale-100 opacity-100"
                      leave="transition duration-75 ease-out"
                      leaveFrom="transform scale-100 opacity-100"
                      leaveTo="transform scale-95 opacity-0"
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
                        <div className="max-h-48 overflow-y-auto overflow-x-hidden">
                          {availableTools.map((tool) => (
                            <Listbox.Option
                              key={tool.function.name}
                              value="addAllFiles"
                              className="text-vsc-foreground block w-full cursor-pointer text-left text-xs brightness-75 hover:brightness-125"
                            >
                              <ToolDropdownItem tool={tool} />
                            </Listbox.Option>
                          ))}
                        </div>
                      </Listbox.Options>
                    </Transition>
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
