import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Editor, JSONContent } from "@tiptap/core";
import { InputModifiers } from "core";
import { stripImages } from "core/llm/images";
import { useContext, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { NewSessionButton } from "../../components/mainInput/NewSessionButton";
import resolveEditorContent from "../../components/mainInput/resolveInput";
import TipTapEditor from "../../components/mainInput/TipTapEditor";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { setEditDone, submitEdit } from "../../redux/slices/editModeState";
import { RootState } from "../../redux/store";
import CodeToEdit from "./CodeToEdit";

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
  const editModeState = useSelector((state: RootState) => state.editModeState);
  const availableContextProviders = useSelector(
    (store: RootState) => store.state.config.contextProviders,
  );

  const applyState = useSelector(
    (store: RootState) =>
      store.state.applyStates.find((state) => state.streamId === "edit")
        ?.status ?? "closed",
  );

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

  const isStreaming =
    editModeState.editStatus === "streaming" ||
    editModeState.editStatus === "accepting";

  const toolbarOptions = {
    hideAddContext: true,
    hideImageUpload: true,
    hideUseCodebase: true,
    hideSelectModel: false,
    enterText: isStreaming ? "Retry" : "Edit",
  };

  const filteredContextProviders = availableContextProviders.filter(
    (provider) => !EDIT_DISALLOWED_CONTEXT_PROVIDERS.includes(provider.title),
  );

  const handleEditorEnter = async (
    editorState: JSONContent,
    modifiers: InputModifiers,
    editor: Editor,
  ) => {
    const [contextItems, __, userInstructions] = await resolveEditorContent(
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
    editor.commands.selectTextblockEnd();
  };

  const handleBackClick = () => {
    dispatch(setEditDone());
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="m-auto max-w-3xl">
        <div className="relative mb-1 mt-3 flex flex-col px-2">
          <CodeToEdit />
          <TipTapEditor
            isMainInput
            toolbarOptions={toolbarOptions}
            placeholder="Describe how to modify code"
            availableContextProviders={filteredContextProviders}
            historyKey="edit"
            availableSlashCommands={[]}
            onEnter={handleEditorEnter}
          />
        </div>
      </div>

      <div className="mt-2">
        <NewSessionButton
          onClick={handleBackClick}
          className="mr-auto flex items-center gap-2"
        >
          <ArrowLeftIcon width="11px" height="11px" />
          Back to Chat
        </NewSessionButton>
      </div>
    </div>
  );
}
