import { useCallback, useState } from "react";
import styled from "styled-components";
import {
  defaultBorderRadius,
  vscCommandCenterInactiveBorder,
  vscInputBackground,
} from "../..";
import { useAppSelector } from "../../../redux/hooks";
import { LumpProvider } from "./LumpContext";
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
 * Main component that displays the toolbar and selected content section
 */
export function Lump() {
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [displayedSection, setDisplayedSection] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const isStreaming = useAppSelector((state) => state.session.isStreaming);

  // Handle keyboard escape
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape" && selectedSection) {
        setSelectedSection(null);
      }
    },
    [selectedSection],
  );

  // Function to hide the lump
  const hideLump = useCallback(() => {
    setSelectedSection(null);
  }, []);

  // Reset when streaming starts
  if (isStreaming && selectedSection) {
    setSelectedSection(null);
  }

  // Update displayedSection and visibility when selectedSection changes
  if (selectedSection) {
    if (displayedSection !== selectedSection || !isVisible) {
      setDisplayedSection(selectedSection);
      setIsVisible(true);
    }
  } else if (isVisible) {
    setIsVisible(false);
    setTimeout(() => {
      setDisplayedSection(null);
    }, 300);
  }

  // Set up keyboard listener
  if (selectedSection) {
    document.addEventListener("keydown", handleKeyDown);
  } else {
    document.removeEventListener("keydown", handleKeyDown);
  }

  return (
    <LumpProvider
      isLumpVisible={isVisible}
      selectedSection={selectedSection}
      hideLump={hideLump}
      setSelectedSection={setSelectedSection}
    >
      <LumpDiv>
        <div className="mt-0.5 px-2">
          <LumpToolbar
            selectedSection={selectedSection}
            setSelectedSection={setSelectedSection}
          />

          <ContentDiv
            className="no-scrollbar pr-0.5"
            hasSection={!!selectedSection}
            isVisible={isVisible}
          >
            <SelectedSection selectedSection={displayedSection} />
          </ContentDiv>
        </div>
      </LumpDiv>
    </LumpProvider>
  );
}
