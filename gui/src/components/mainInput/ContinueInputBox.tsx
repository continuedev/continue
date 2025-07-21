import { Editor, JSONContent } from "@tiptap/react";
import { ContextItemWithId, InputModifiers, RuleWithSource } from "core";
import { useMemo } from "react";
import { defaultBorderRadius, vscBackground } from "..";
import { useAppSelector } from "../../redux/hooks";
import { selectSlashCommandComboBoxInputs } from "../../redux/selectors";
import { ContextItemsPeek } from "./belowMainInput/ContextItemsPeek";
import { RulesPeek } from "./belowMainInput/RulesPeek";
import { GradientBorder } from "./GradientBorder";
import { ToolbarOptions } from "./InputToolbar";
import { Lump } from "./Lump";
import { TipTapEditor } from "./TipTapEditor";

interface ContinueInputBoxProps {
  isLastUserInput: boolean;
  isMainInput?: boolean;
  onEnter: (
    editorState: JSONContent,
    modifiers: InputModifiers,
    editor: Editor,
  ) => void;
  editorState?: JSONContent;
  contextItems?: ContextItemWithId[];
  appliedRules?: RuleWithSource[];
  hidden?: boolean;
  inputId: string; // used to keep track of things per input in redux
}

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

function ContinueInputBox(props: ContinueInputBoxProps) {
  const isStreaming = useAppSelector((state) => state.session.isStreaming);
  const availableSlashCommands = useAppSelector(
    selectSlashCommandComboBoxInputs,
  );
  const availableContextProviders = useAppSelector(
    (state) => state.config.config.contextProviders,
  );
  const isInEdit = useAppSelector((store) => store.session.isInEdit);
  const editModeState = useAppSelector((state) => state.editModeState);

  const filteredSlashCommands = useMemo(() => {
    return isInEdit ? [] : availableSlashCommands;
  }, [isInEdit, availableSlashCommands]);

  const filteredContextProviders = useMemo(() => {
    if (isInEdit) {
      return (
        availableContextProviders?.filter(
          (provider) =>
            !EDIT_DISALLOWED_CONTEXT_PROVIDERS.includes(provider.title),
        ) ?? []
      );
    }

    return availableContextProviders ?? [];
  }, [availableContextProviders, isInEdit]);

  const historyKey = isInEdit ? "edit" : "chat";
  const placeholder = isInEdit ? "Edit selected code" : undefined;

  const toolbarOptions: ToolbarOptions = isInEdit
    ? {
        hideAddContext: false,
        hideImageUpload: false,
        hideUseCodebase: true,
        hideSelectModel: false,
        enterText:
          editModeState.applyState.status === "done" ? "Retry" : "Edit",
      }
    : {};

  const { appliedRules = [], contextItems = [] } = props;

  return (
    <div
      className={`${props.hidden ? "hidden" : ""}`}
      data-testid={`continue-input-box-${props.inputId}`}
    >
      <div className={`relative flex flex-col px-2`}>
        {props.isMainInput && <Lump />}
        <GradientBorder
          loading={isStreaming && props.isLastUserInput ? 1 : 0}
          borderColor={
            isStreaming && props.isLastUserInput ? undefined : vscBackground
          }
          borderRadius={defaultBorderRadius}
        >
          <TipTapEditor
            editorState={props.editorState}
            onEnter={props.onEnter}
            placeholder={placeholder}
            isMainInput={props.isMainInput ?? false}
            availableContextProviders={filteredContextProviders}
            availableSlashCommands={filteredSlashCommands}
            historyKey={historyKey}
            toolbarOptions={toolbarOptions}
            inputId={props.inputId}
          />
        </GradientBorder>
      </div>

      {(appliedRules.length > 0 || contextItems.length > 0) && (
        <div className="mt-2 flex flex-col">
          <RulesPeek appliedRules={props.appliedRules} />
          <ContextItemsPeek
            contextItems={props.contextItems}
            isCurrentContextPeek={props.isLastUserInput}
          />
        </div>
      )}
    </div>
  );
}

export default ContinueInputBox;
