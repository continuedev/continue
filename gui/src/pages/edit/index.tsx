import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Editor, JSONContent } from "@tiptap/core";
import { InputModifiers } from "core";
import { stripImages } from "core/llm/images";
import { useContext, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  vscForeground,
} from "../../components";
import { NewSessionButton } from "../../components/mainInput/NewSessionButton";
import resolveEditorContent from "../../components/mainInput/resolveInput";
import TipTapEditor from "../../components/mainInput/TipTapEditor";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { setEditDone, submitEdit } from "../../redux/slices/editModeState";
import { RootState } from "../../redux/store";
import { EditInputHeader } from "./EditInputHeader";

const TopDiv = styled.div`
  overflow-y: auto;
  height: 100%;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const ToolbarDiv = styled.div`
  padding: 8px;
  border-bottom: 1px solid ${lightGray};
  border-radius: ${defaultBorderRadius};
  display: flex;
`;

const AcceptRejectButton = styled.div<{
  backgroundColor: string;
  disabled: boolean;
}>`
  border: none;
  background-color: ${(props) => props.backgroundColor};
  border-radius: ${defaultBorderRadius};
  padding: 8px 16px;
  color: ${vscForeground};
  width: 100%;
  text-align: center;
  margin: 0 8px;
  transition: filter 0.2s ease;

  opacity: ${(props) => (props.disabled ? 0.5 : 1)};
  cursor: ${(props) => (props.disabled ? "default" : "pointer")};

  &:hover {
    filter: ${(props) => (props.disabled ? "none" : "brightness(1.2)")};
  }
`;

const EditHistoryDiv = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 16px;

  cursor: pointer;

  border: 1px solid ${lightGray}55;
  border-radius: ${defaultBorderRadius};

  &:hover {
    background-color: ${lightGray}22;
  }
`;

const EDIT_DISALLOWED_CONTEXT_PROVIDERS = [
  "codebase",
  "tree",
  "open",
  "web",
  "diff",
  "folder",
  "search",
  "debugger",
  "repo-map",
];

function Edit() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const ideMessenger = useContext(IdeMessengerContext);
  const editModeState = useSelector((state: RootState) => state.editModeState);
  const availableContextProviders = useSelector(
    (store: RootState) => store.state.config.contextProviders,
  );
  useEffect(() => {}, []);

  // Reusing the applyState logic which was just the fastest way to get this working
  useEffect(() => {
    if (editModeState.editStatus === "done") {
      ideMessenger.post("edit/escape", undefined);
      navigate("/");
    }
  }, [editModeState.editStatus]);

  const applyState = useSelector(
    (store: RootState) =>
      store.uiState.applyStates.find((state) => state.streamId === "edit")
        ?.status ?? "closed",
  );

  useEffect(() => {
    if (applyState === "closed" && editModeState.editStatus === "accepting") {
      dispatch(dispatch(setEditDone()));
    }
  }, [applyState, editModeState.editStatus]);

  return (
    <>
      <TopDiv>
        <div className="m-auto max-w-3xl">
          {/* Edit session history */}
          {/* {editModeState.previousInputs.length > 0 && (
            <div className="mt-3 px-2">
              {editModeState.previousInputs.map((input, index) => (
                <div key={index} className="flex items-center gap-2">
                  <EditHistoryDiv>
                    <div className="text-gray-400">{stripImages(input)}</div>
                    <EyeIcon className="ml-auto h-4 w-4" color={lightGray} />
                  </EditHistoryDiv>
                </div>
              ))}
            </div>
          )} */}

          <div className="relative mb-1 mt-3 flex px-2">
            <TipTapEditor
              header={<EditInputHeader />}
              toolbarOptions={{
                hideAddContext: true,
                hideImageUpload: true,
                hideUseCodebase: true,
                hideSelectModel: false,
                enterText: ["streaming", "accepting"].includes(
                  editModeState.editStatus,
                )
                  ? "Retry"
                  : "Edit",
              }}
              placeholder={
                ["streaming", "accepting"].includes(editModeState.editStatus)
                  ? "Describe how to modify code"
                  : "Describe how to modify code"
              }
              border={`1px solid #aa0`}
              availableContextProviders={availableContextProviders.filter(
                (provider) =>
                  !EDIT_DISALLOWED_CONTEXT_PROVIDERS.includes(provider.title),
              )}
              historyKey="edit"
              availableSlashCommands={[]}
              isMainInput={true}
              onEnter={async function (
                editorState: JSONContent,
                modifiers: InputModifiers,
                editor: Editor,
              ): Promise<void> {
                const [contextItems, __, userInstructions] =
                  await resolveEditorContent(
                    editorState,
                    {
                      noContext: true,
                      useCodebase: false,
                    },
                    ideMessenger,
                    [],
                  );

                const prompt = [
                  ...contextItems.map((item) => item.content),
                  stripImages(userInstructions),
                ].join("\n\n");
                ideMessenger.post("edit/sendPrompt", {
                  prompt,
                  range: editModeState.highlightedCode,
                });
                dispatch(submitEdit(prompt));

                // Move cursor to end of editor (it's already focused)
                editor.commands.selectTextblockEnd();
              }}
            ></TipTapEditor>
          </div>
        </div>

        <div className="mt-2">
          <NewSessionButton
            onClick={async () => {
              dispatch(setEditDone());
            }}
            className="mr-auto flex items-center gap-2"
          >
            <ArrowLeftIcon width="11px" height="11px" />
            Back to Chat
          </NewSessionButton>
        </div>
      </TopDiv>
    </>
  );
}
export default Edit;
