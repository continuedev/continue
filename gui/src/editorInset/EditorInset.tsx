import { useContext, useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import styled from "styled-components";
import { defaultBorderRadius } from "../components";
import TipTapEditor from "../components/mainInput/TipTapEditor";
import { IdeMessengerContext } from "../context/IdeMessenger";
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

  const ideMessenger = useContext(IdeMessengerContext);

  useEffect(() => {
    if (!elementRef.current) return;
    const resizeObserver = new ResizeObserver(() => {
      if (!elementRef.current) return;

      console.log("Height: ", elementRef.current.clientHeight);
      ideMessenger.post("jetbrains/editorInsetHeight", {
        height: elementRef.current.clientHeight,
      });
    });
    resizeObserver.observe(elementRef.current);
    return () => resizeObserver.disconnect();
  }, []);

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
      ></TipTapEditor>
    </EditorInsetDiv>
  );
}

export default EditorInset;
