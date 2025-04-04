import { getMarkdownLanguageTagForFile } from "core/util";
import { useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import StyledMarkdownPreview from "../../../components/markdown/StyledMarkdownPreview";
import { useAppDispatch } from "../../../redux/hooks";
import { setLastApplyToolStreamId } from "../../../redux/slices/sessionSlice";

type EditToolCallProps = {
  relativeFilePath: string;
  newContents: string;
};

export function EditFile(props: EditToolCallProps) {
  const dispatch = useAppDispatch();
  const src = `\`\`\`${getMarkdownLanguageTagForFile(props.relativeFilePath ?? "test.txt")} ${props.relativeFilePath}\n${props.newContents ?? ""}\n\`\`\``;

  const streamId = useMemo(() => {
    const id = uuidv4();
    dispatch(setLastApplyToolStreamId({ streamId: id }));
    return id;
  }, []);

  return props.relativeFilePath ? (
    <StyledMarkdownPreview
      isRenderingInStepContainer={true}
      source={src}
      hideApply={true}
      firstCodeblockStreamId={streamId}
    />
  ) : null;
}
