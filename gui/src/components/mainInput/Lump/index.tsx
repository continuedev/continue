import styled from "styled-components";
import {
  defaultBorderRadius,
  vscCommandCenterInactiveBorder,
  vscInputBackground,
} from "../..";
import { useLump } from "./LumpContext";
import { LumpToolbar } from "./LumpToolbar";
import { SelectedSection } from "./sections/SelectedSection";

const LumpDiv = styled.div`
  background-color: ${vscInputBackground};
  margin-left: 4px;
  margin-right: 4px;
  border-radius: ${defaultBorderRadius} ${defaultBorderRadius} 0 0;
  border-top: 1px solid ${vscCommandCenterInactiveBorder};
  border-left: 1px solid ${vscCommandCenterInactiveBorder};
  border-right: 1px solid ${vscCommandCenterInactiveBorder};
`;

const ContentDiv = styled.div<{ hasSection: boolean; isVisible: boolean }>`
  transition:
    max-height 0.3s ease-in-out,
    margin 0.3s ease-in-out,
    opacity 0.2s ease-in-out;
  max-height: ${(props) => (props.hasSection ? "200px" : "0px")};
  margin: ${(props) => (props.hasSection ? "4px 0" : "0")};
  opacity: ${(props) => (props.isVisible ? "1" : "0")};
  overflow-y: auto;
`;

/**
 * Internal component that consumes the LumpContext
 */
export function Lump() {
  const { isLumpVisible, selectedSection } = useLump();

  return (
    <LumpDiv>
      <div className="mt-0.5 px-2">
        <LumpToolbar />

        <ContentDiv
          className="no-scrollbar pr-0.5"
          hasSection={!!selectedSection}
          isVisible={isLumpVisible}
        >
          <SelectedSection />
        </ContentDiv>
      </div>
    </LumpDiv>
  );
}
