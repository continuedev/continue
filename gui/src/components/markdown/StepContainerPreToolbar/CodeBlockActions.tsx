import { useContext, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { text } from "stream/consumers";
import { lightGray } from "../..";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { defaultModelSelector } from "../../../redux/selectors/modelSelectors";
import { updateApplyState } from "../../../redux/slices/uiStateSlice";
import { RootState } from "../../../redux/store";
import { getFontSize, isJetBrains } from "../../../util";
import ApplyStateControls from "./ApplyButton";
import { isTerminalCodeBlock } from "./utils";
import { v4 as uuidv4 } from "uuid";
import { StepContainerPreToolbarProps } from "./StepContainerPreToolbar";
import ApplyButton from "./ApplyButton";

interface CodeBlockActionsProps extends StepContainerPreToolbarProps {
  handleApply: () => Promise<void>;
  codeBlockContent: string;
}

export default function CodeBlockActions({
  filepath,
  language,
  isGenerating,
}: CodeBlockActionsProps) {
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const defaultModel = useSelector(defaultModelSelector);
  const streamIdRef = useRef<string | null>(null);

  const hasFileExtension = /\.[0-9a-z]+$/i.test(filepath);

  if (streamIdRef.current === null) {
    streamIdRef.current = uuidv4();
  }

  const applyState = useSelector(
    (store: RootState) =>
      store.uiState.applyStates.find(
        (state) => state.streamId === streamIdRef.current,
      )?.status ?? "closed",
  );

  const [isCopied, setIsCopied] = useState(false);

  const isTerminal = isTerminalCodeBlock(language, text);

  const onClickCopy = async () => {
    if (isJetBrains()) {
      await ideMessenger.request("copyText", { text });
    } else {
      await navigator.clipboard.writeText(text);
    }
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  async function onClickApply() {
    if (isTerminal) {
      await ideMessenger.ide.runCommand(text);
      return;
    }

    if (!filepath) return;

    dispatch(
      updateApplyState({
        streamId: streamIdRef.current,
        status: "streaming",
      }),
    );

    ideMessenger.post("applyToFile", {
      curSelectedModelTitle: defaultModel.title,
      text,
      streamId: streamIdRef.current,
      filepath,
    });
  }

  const onClickHeader = () => ideMessenger.post("showFile", { filepath });
  const onClickAccept = () => ideMessenger.post("acceptDiff", { filepath });
  const onClickReject = () => ideMessenger.post("rejectDiff", { filepath });

  return (
    <div
      className={`flex items-center justify-between bg-inherit ${getFontSize() - 2}px border-b px-2 py-1 border-${lightGray}80 m-0`}
    >
      {filepath && (
        <FilePathDisplay
          filepath={filepath}
          onToggleExpand={onToggleExpand}
          onClickHeader={onClickHeader}
          isExpanded={isExpanded}
        />
      )}

      <ApplyButton
        applyState={applyState}
        onClickApply={onClickApply}
        onClickAccept={onClickAccept}
        onClickReject={onClickReject}
      />
    </div>
  );
}
