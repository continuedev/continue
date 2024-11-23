import { Listbox } from "@headlessui/react";
import {
  ChevronDownIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { modelSupportsTools } from "core/llm/autodetect";
import { useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import styled from "styled-components";
import { defaultBorderRadius, lightGray, vscForeground } from "../..";
import { defaultModelSelector } from "../../../redux/selectors/modelSelectors";
import { toggleUseTools } from "../../../redux/slices/uiStateSlice";
import { RootState } from "../../../redux/store";
import { getFontSize } from "../../../util";
import HoverItem from "./HoverItem";

const BackgroundDiv = styled.div<{ useTools: boolean }>`
  background-color: ${(props) =>
    props.useTools ? `${lightGray}33` : "transparent"};
  border-radius: ${defaultBorderRadius};
  padding: 1px;

  font-size: ${getFontSize() - 4}px;

  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;

  transition: background-color 200ms;
`;

export default function ToolDropdown() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dispatch = useDispatch();

  const useTools = useSelector((store: RootState) => store.uiState.useTools);
  const defaultModel = useSelector(defaultModelSelector);

  if (!modelSupportsTools(defaultModel.model)) {
    return null;
  }

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
            <span>Tools</span>

            <div className="relative">
              <Listbox onChange={() => {}}>
                <Listbox.Button
                  ref={buttonRef}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="text-lightgray flex cursor-pointer items-center border-none bg-transparent outline-none"
                >
                  <ChevronDownIcon className="h-3 w-3" />
                </Listbox.Button>
                <Listbox.Options className="bg-vsc-editor-background border-lightgray/50 absolute right-0 top-full z-50 mt-1 min-w-fit whitespace-nowrap rounded-md border border-solid px-1 py-0 shadow-lg">
                  <Listbox.Option
                    value="addAllFiles"
                    className="text-vsc-foreground block w-full cursor-pointer px-2 py-1 text-left text-[10px] brightness-75 hover:brightness-125"
                  >
                    Add all open files
                  </Listbox.Option>
                </Listbox.Options>
              </Listbox>
            </div>
          </>
        )}
      </BackgroundDiv>
    </HoverItem>
  );
}
