import { useSelector } from "react-redux";
import styled from "styled-components";
import TipTapEditor from "../components/mainInput/TipTapEditor";
import { selectSlashCommands } from "../redux/selectors";
import { RootState } from "../redux/store";

const EditorInsetDiv = styled.div`
  max-width: 500px;
`;

function EditorInset() {
  const availableSlashCommands = useSelector(selectSlashCommands);
  const availableContextProviders = useSelector(
    (store: RootState) => store.state.config.contextProviders,
  );

  return (
    <EditorInsetDiv>
      <div className="flex px-2 relative">
        <TipTapEditor
          availableContextProviders={availableContextProviders}
          availableSlashCommands={availableSlashCommands}
          isMainInput={true}
          onEnter={(e) => {
            console.log("Enter: ", e);
          }}
        ></TipTapEditor>
      </div>
    </EditorInsetDiv>
  );
}

export default EditorInset;
