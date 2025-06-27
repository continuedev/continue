import { getMarkdownLanguageTagForFile } from "core/util";
import { useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import StyledMarkdownPreview from "../../../components/StyledMarkdownPreview";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import {
  selectApplyStateByToolCallId,
  updateApplyState,
} from "../../../redux/slices/sessionSlice";

type EditToolCallProps = {
  relativeFilePath: string;
  changes: string;
  historyIndex: number;
  toolCallId?: string;
  expandCodeblocks?: boolean;
};

export function EditFile(props: EditToolCallProps) {
  const dispatch = useAppDispatch();

  const applyState = useAppSelector((state) =>
    selectApplyStateByToolCallId(state, props.toolCallId),
  );

  useEffect(() => {
    if (!applyState) {
      dispatch(
        updateApplyState({
          streamId: uuidv4(),
          toolCallId: props.toolCallId,
          status: "not-started",
        }),
      );
    }
  }, [applyState, props.toolCallId]);

  if (!props.relativeFilePath || !props.changes) {
    return null;
  }

  const src = `\`\`\`${getMarkdownLanguageTagForFile(props.relativeFilePath ?? "test.txt")} ${props.relativeFilePath}\n${props.changes}\n\`\`\``;

  return (
    <StyledMarkdownPreview
      expandCodeblocks={props.expandCodeblocks ?? false}
      isRenderingInStepContainer
      disableManualApply
      source={src}
      forceStreamId={applyState?.streamId}
      itemIndex={props.historyIndex}
    />
  );
}
