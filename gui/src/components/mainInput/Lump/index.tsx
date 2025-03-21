import { useEffect, useState } from "react";
import styled from "styled-components";
import {
  defaultBorderRadius,
  vscCommandCenterInactiveBorder,
  vscInputBackground,
} from "../..";
import { TopInputToolbar } from "./TopInputToolbar";
import { SelectedSection } from "./sections/SelectedSection";

interface LumpProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const LumpDiv = styled.div<{ open: boolean }>`
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

export function Lump(props: LumpProps) {
  const { open, setOpen } = props;
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [displayedSection, setDisplayedSection] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (selectedSection) {
      setDisplayedSection(selectedSection);
      setIsVisible(true);
    } else {
      setIsVisible(false);
      // Delay clearing the displayed section until after the fade-out
      const timeout = setTimeout(() => {
        setDisplayedSection(null);
      }, 300); // Match the transition duration
      return () => clearTimeout(timeout);
    }
  }, [selectedSection]);

  if (!open) {
    return null;
  }

  return (
    <LumpDiv open={open}>
      <div className="mt-0.5 px-2">
        <TopInputToolbar
          selectedSection={selectedSection}
          setSelectedSection={setSelectedSection}
        />

        <ContentDiv hasSection={!!selectedSection} isVisible={isVisible}>
          <SelectedSection selectedSection={displayedSection} />
        </ContentDiv>
      </div>
    </LumpDiv>
  );
}
