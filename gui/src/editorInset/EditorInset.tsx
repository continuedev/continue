import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import styled from "styled-components";
import { defaultBorderRadius } from "../components";
import TipTapEditor from "../components/mainInput/TipTapEditor";
import useSetup from "../hooks/useSetup";
import { selectSlashCommands } from "../redux/selectors";
import { RootState } from "../redux/store";
import { ideRequest } from "../util/ide";

const EditorInsetDiv = styled.div`
  max-width: 500px;
  position: relative;
  display: flex;
  border-radius: ${defaultBorderRadius};
  // box-shadow: 0 0 8px 0 rgba(0, 0, 0, 0.4);
`;

function EditorInset() {
  const dispatch = useDispatch();
  const availableSlashCommands = useSelector(selectSlashCommands);
  const availableContextProviders = useSelector(
    (store: RootState) => store.state.config.contextProviders,
  );

  useSetup(dispatch);

  const elementRef = useRef(null);

  useEffect(() => {
    if (!elementRef.current) return;
    const resizeObserver = new ResizeObserver(() => {
      if (!elementRef.current) return;

      console.log("Height: ", elementRef.current.clientHeight);
      ideRequest("jetbrains/editorInsetHeight", {
        height: elementRef.current.clientHeight,
      });
    });
    resizeObserver.observe(elementRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <EditorInsetDiv ref={elementRef}>
      <TipTapEditor
        availableContextProviders={availableContextProviders}
        availableSlashCommands={availableSlashCommands}
        isMainInput={true}
        onEnter={(e, modifiers) => {
          console.log("Enter: ", e, modifiers);
        }}
      ></TipTapEditor>
    </EditorInsetDiv>
  );
}

export default EditorInset;
