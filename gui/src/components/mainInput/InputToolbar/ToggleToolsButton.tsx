import { Listbox, Transition } from "@headlessui/react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { modelSupportsTools } from "core/llm/autodetect";
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
import { selectDefaultModel } from "../../../redux/slices/configSlice";

const BackgroundDiv = styled.div<{ useTools: boolean }>`
  background-color: ${(props) =>
    props.useTools ? `${lightGray}33` : "transparent"};
  border-radius: ${defaultBorderRadius};
  padding: 1px;

  font-size: ${getFontSize() - 4}px;

  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 2px;

  transition: background-color 200ms;
`;

export default function ToolDropdown() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dispatch = useDispatch();
  const [isDropdownOpen, setDropdownOpen] = useState(false);

  const useTools = useAppSelector((state) => state.ui.useTools);
  const availableTools = useAppSelector((state) => state.config.config.tools);
  const [showAbove, setShowAbove] = useState(false);

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
      <BackgroundDiv useTools={useTools}>
        <WrenchScrewdriverIcon
          className="h-4 w-4 text-gray-400"
          style={{
            color: useTools && vscForeground,
            padding: "1px",
            transition: "background-color 200ms",
          }}
        />
        {useTools && (
          <>
            <span className="hidden md:flex">Tools</span>

            <div className="relative">
              <Listbox onChange={() => {}}>
                <Listbox.Button
                  ref={buttonRef}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDropdownOpen((prev) => !prev);
                  }}
                  className="text-lightgray flex cursor-pointer items-center border-none bg-transparent outline-none"
                >
                  {isDropdownOpen ? (
                    <ChevronUpIcon className="h-3 w-3" />
                  ) : (
                    <ChevronDownIcon className="h-3 w-3" />
                  )}
                </Listbox.Button>
                <Transition show={isDropdownOpen}>
                  <Listbox.Options
                    className={`bg-vsc-editor-background border-lightgray/50 absolute -left-32 z-50 mb-1 min-w-fit whitespace-nowrap rounded-md border border-solid px-1 py-0 shadow-lg ${showAbove ? "bottom-full" : ""}`}
                  >
                    <div className="sticky">
                      <div
                        className="mb-1 flex items-center gap-2 px-2 py-1"
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
                                <span className="text-red-500">Disabled:</span>{" "}
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
                          className="text-vsc-foreground block w-full cursor-pointer text-left text-[10px] brightness-75 hover:brightness-125"
                        >
                          <ToolDropdownItem tool={tool} />
                        </Listbox.Option>
                      ))}
                    </div>
                  </Listbox.Options>
                </Transition>
              </Listbox>
            </div>
          </>
        )}
      </BackgroundDiv>
    </HoverItem>
  );
}
