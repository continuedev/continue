import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Editor, JSONContent } from "@tiptap/core";
import { InputModifiers } from "core";
import { stripImages } from "core/llm/images";
import { useCallback, useContext, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { NewSessionButton } from "../../components/mainInput/NewSessionButton";
import resolveEditorContent from "../../components/mainInput/resolveInput";
import TipTapEditor from "../../components/mainInput/TipTapEditor";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import {
  clearCodeToEdit,
  setEditDone,
  submitEdit,
} from "../../redux/slices/editModeState";
import { RootState } from "../../redux/store";
import CodeToEdit from "./CodeToEdit";
import useChatHandler from "../../hooks/useChatHandler";
import AcceptRejectAllButtons from "../../components/StepContainer/AcceptRejectAllButtons";
import ContinueInputBox from "../../components/mainInput/ContinueInputBox";
import StepContainer from "../../components/StepContainer";
import styled from "styled-components";
import getMultifileEditPrompt from "./getMultifileEditPrompt";
import { RangeInFileWithContents } from "core/commands/util";

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

export default function Edit() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const ideMessenger = useContext(IdeMessengerContext);
  const { streamResponse } = useChatHandler(dispatch, ideMessenger);
  const editModeState = useSelector((state: RootState) => state.editModeState);
  const availableContextProviders = useSelector(
    (store: RootState) => store.state.config.contextProviders,
  );

  const history = useSelector((state: RootState) => state.state.history);

  const applyStates = useSelector(
    (state: RootState) => state.state.applyStates,
  );

  const applyState = useSelector(
    (store: RootState) =>
      store.state.applyStates.find((state) => state.streamId === "edit")
        ?.status ?? "closed",
  );

  const isSingleRangeEdit =
    editModeState.codeToEdit.length === 0 ||
    (editModeState.codeToEdit.length === 1 &&
      "range" in editModeState.codeToEdit[0]);

  useEffect(() => {
    if (editModeState.editStatus === "done") {
      ideMessenger.post("edit/escape", undefined);
      navigate("/");
    }
  }, [editModeState.editStatus]);

  useEffect(() => {
    if (applyState === "closed" && editModeState.editStatus === "accepting") {
      dispatch(setEditDone());
    }
  }, [applyState, editModeState.editStatus]);

  // const active = useSelector((state: RootState) => state.state.active);

  const pendingApplyStates = applyStates.filter(
    (state) => state.status === "done",
  );

  const isStreaming =
    editModeState.editStatus === "streaming" ||
    editModeState.editStatus === "accepting";

  const toolbarOptions = {
    hideAddContext: false,
    hideImageUpload: false,
    hideUseCodebase: true,
    hideSelectModel: false,
    enterText: isStreaming ? "Retry" : "Edit",
  };

  const hasPendingApplies = pendingApplyStates.length > 0;

  const filteredContextProviders = availableContextProviders.filter(
    (provider) => !EDIT_DISALLOWED_CONTEXT_PROVIDERS.includes(provider.title),
  );

  async function handleSingleRangeEdit(
    editorState: JSONContent,
    modifiers: InputModifiers,
    editor: Editor,
  ) {
    const [contextItems, __, userInstructions] = await resolveEditorContent(
      editorState,
      {
        noContext: true,
        useCodebase: false,
      },
      ideMessenger,
      [],
      dispatch,
    );

    const prompt = [
      ...contextItems.map((item) => item.content),
      stripImages(userInstructions),
    ].join("\n\n");

    const codeToEdit = editModeState.codeToEdit[0];

    let rif: RangeInFileWithContents = {
      filepath: codeToEdit.filepath,
      contents: codeToEdit.contents,
      range: "range" in codeToEdit ? codeToEdit.range : undefined,
    };

    ideMessenger.post("edit/sendPrompt", {
      prompt,
      range: editModeState.codeToEdit[0] as RangeInFileWithContents,
    });

    dispatch(submitEdit(prompt));
    editor.commands.selectTextblockEnd();
  }

  async function handleEditorEnter(
    editorState: JSONContent,
    modifiers: InputModifiers,
    editor: Editor,
  ) {
    if (isSingleRangeEdit) {
      handleSingleRangeEdit(editorState, modifiers, editor);
    } else {
      const promptPreamble = getMultifileEditPrompt(editModeState.codeToEdit);

      streamResponse(
        editorState,
        modifiers,
        ideMessenger,
        undefined,
        promptPreamble,
      );
    }
  }

  function handleBackClick() {
    dispatch(setEditDone());
  }

  const isLastUserInput = useCallback(
    (index: number): boolean => {
      return !history
        .slice(index + 1)
        .some((entry) => entry.message.role === "user");
    },
    [history],
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="m-auto max-w-3xl">
        <div className="relative mb-1 mt-3 flex flex-col px-2">
          <CodeToEdit />
          <TipTapEditor
            isMainInput
            toolbarOptions={toolbarOptions}
            placeholder="Describe how to modify the code - use '#' to add files"
            availableContextProviders={filteredContextProviders}
            historyKey="edit"
            availableSlashCommands={[]}
            onEnter={handleEditorEnter}
          />
        </div>

        {!isSingleRangeEdit && history.length > 1 && (
          <div>
            {history.slice(1).map((item, index: number) => (
              <div>
                {item.message.role === "user" ? (
                  <ContinueInputBox
                    onEnter={async (editorState, modifiers) => {
                      streamResponse(
                        editorState,
                        modifiers,
                        ideMessenger,
                        index,
                      );
                    }}
                    isLastUserInput={isLastUserInput(index)}
                    isMainInput={false}
                    editorState={item.editorState}
                    contextItems={item.contextItems}
                  />
                ) : (
                  <StepContainer
                    index={index}
                    isLast={index === history.length - 1}
                    item={item}
                  />
                )}
              </div>
            ))}

            {/* {!active && (
              <ContinueInputBox
                isMainInput
                isLastUserInput={false}
                onEnter={handleEditorEnter}
              />
            )} */}
          </div>
        )}

        <div className="mt-2">
          {hasPendingApplies && isSingleRangeEdit && (
            <AcceptRejectAllButtons
              pendingApplyStates={pendingApplyStates}
              onAcceptOrReject={() => dispatch(clearCodeToEdit())}
            />
          )}

          {!hasPendingApplies && isSingleRangeEdit && (
            <NewSessionButton
              onClick={handleBackClick}
              className="mr-auto flex items-center gap-2"
            >
              <ArrowLeftIcon width="11px" height="11px" />
              Back to Chat
            </NewSessionButton>
          )}
        </div>
      </div>
    </div>
  );
}
