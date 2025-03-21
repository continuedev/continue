import { useState } from "react";
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

export function Lump(props: LumpProps) {
  const { open, setOpen } = props;
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

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

        <div
          className={`${selectedSection ? "my-1" : ""} max-h-[200px] overflow-y-auto`}
        >
          <SelectedSection selectedSection={selectedSection} />
        </div>
      </div>
    </LumpDiv>
  );
}
