import {
  ChevronDownIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { useDispatch, useSelector } from "react-redux";
import styled from "styled-components";
import {
  defaultBorderRadius,
  vscForeground,
  vscListActiveBackground,
} from "../..";
import { toggleUseTools } from "../../../redux/slices/uiStateSlice";
import { RootState } from "../../../redux/store";
import { getFontSize } from "../../../util";
import { ToolTip } from "../../gui/Tooltip";
import HoverItem from "./HoverItem";

const BackgroundDiv = styled.div<{ useTools: boolean }>`
  background-color: ${(props) =>
    props.useTools ? vscListActiveBackground : "transparent"};
  border-radius: ${defaultBorderRadius};
  padding: 1px;

  font-size: ${getFontSize() - 4}px;

  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;

  transition: background-color 200ms;
`;

interface ToggleToolsButtonProps {}

function ToggleToolsButton(props: ToggleToolsButtonProps) {
  const dispatch = useDispatch();

  const useTools = useSelector((store: RootState) => store.uiState.useTools);
  return (
    <HoverItem onClick={() => dispatch(toggleUseTools())}>
      <BackgroundDiv useTools={useTools}>
        <WrenchScrewdriverIcon
          data-tooltip-id="tools-tooltip"
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
            <ChevronDownIcon
              data-tooltip-id="tools-tooltip"
              className="h-3 w-3"
            />
          </>
        )}
        <ToolTip id="tools-tooltip" place="top-start">
          Tools
        </ToolTip>
      </BackgroundDiv>
    </HoverItem>
  );
}

export default ToggleToolsButton;
