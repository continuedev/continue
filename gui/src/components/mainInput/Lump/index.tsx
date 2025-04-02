import { useEffect, useState } from "react";
import styled from "styled-components";
import {
  defaultBorderRadius,
  vscCommandCenterInactiveBorder,
  vscInputBackground,
} from "../..";
import { useAppSelector } from "../../../redux/hooks";
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

export function Lump() {
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [displayedSection, setDisplayedSection] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const isStreaming = useAppSelector((state) => state.session.isStreaming);

  useEffect(() => {
    if (!selectedSection) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedSection(null);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedSection]);

  useEffect(() => {
    if (isStreaming) {
      setSelectedSection(null);
    }
  }, [isStreaming]);

  useEffect(() => {
    if (selectedSection) {
      setDisplayedSection(selectedSection);
      setIsVisible(true);
    } else {
      setIsVisible(false);
      const timeout = setTimeout(() => {
        setDisplayedSection(null);
      }, 300);
      return () => {
        clearTimeout(timeout);
      };
    }
  }, [selectedSection]);

  return (
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
  );
}
