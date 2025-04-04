import { getMarkdownLanguageTagForFile } from "core/util";
import { useMemo } from "react";
import StyledMarkdownPreview from "../../../components/markdown/StyledMarkdownPreview";
import AcceptRejectAllButtons from "../../../components/StepContainer/AcceptRejectAllButtons";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectApplyStateByStreamId } from "../../../redux/slices/sessionSlice";

type EditToolCallProps = {
  relativeFilePath: string;
  newContents: string;
};

export function EditFile(props: EditToolCallProps) {
  const src = `\`\`\`${getMarkdownLanguageTagForFile(props.relativeFilePath ?? "test.txt")} ${props.relativeFilePath}\n${props.newContents ?? ""}\n\`\`\``;

  const dispatch = useAppDispatch();

  const isStreaming = useAppSelector((state) => state.session.isStreaming);
  const lastApplyToolStreamId = useAppSelector(
    (state) => state.session.lastApplyToolStreamId,
  );
  const streamId = useMemo(() => {
    return lastApplyToolStreamId;
  }, []);

  console.log("STREAM ID", streamId);

  const applyState = useAppSelector((state) =>
    selectApplyStateByStreamId(state, streamId),
  );

  if (!props.relativeFilePath) {
    return null;
  }

  return (
    <>
      <StyledMarkdownPreview
        isRenderingInStepContainer={true}
        source={src}
        disableManualApply={true}
        firstCodeblockStreamId={streamId}
      />

      {!isStreaming && applyState?.status === "done" && (
        <div className={`mx-2 mb-2 mt-2 flex h-7 items-center justify-center`}>
          <AcceptRejectAllButtons
            pendingApplyStates={[applyState]}
            onAcceptOrReject={async (outcome) => {}}
          />
        </div>
      )}
    </>
  );
}
