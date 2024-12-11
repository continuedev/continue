import { useRef } from "react";
import styled from "styled-components";
import { defaultBorderRadius } from "../components";
import TipTapEditor from "../components/mainInput/TipTapEditor";
import useSetup from "../hooks/useSetup";
import { selectSlashCommandComboBoxInputs } from "../redux/selectors";
import { useAppSelector } from "../redux/hooks";

const EditorInsetDiv = styled.div`
  max-width: 500px;
  position: relative;
  display: flex;
  border-radius: ${defaultBorderRadius};
  // box-shadow: 0 0 8px 0 rgba(0, 0, 0, 0.4);
`;

function EditorInset() {
  const availableSlashCommands = useAppSelector(
    selectSlashCommandComboBoxInputs,
  );
  const availableContextProviders = useAppSelector(
    (store) => store.config.config.contextProviders,
  );

  useSetup();

  const elementRef = useRef<HTMLDivElement | null>(null);

  return (
    <EditorInsetDiv ref={elementRef}>
      <TipTapEditor
        availableContextProviders={availableContextProviders ?? []}
        availableSlashCommands={availableSlashCommands}
        isMainInput={true}
        onEnter={(e, modifiers) => {
          console.log("Enter: ", e, modifiers);
        }}
        historyKey="chat"
      />
    </EditorInsetDiv>
  );
}

export default EditorInset;
