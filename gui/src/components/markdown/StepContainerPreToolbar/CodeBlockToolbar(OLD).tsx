import { useContext, useRef, useState } from "react";
import styled from "styled-components";
import { useDispatch, useSelector } from "react-redux";
import { v4 as uuidv4 } from "uuid";
import { lightGray } from "../..";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { defaultModelSelector } from "../../../redux/selectors/modelSelectors";
import { updateApplyState } from "../../../redux/slices/uiStateSlice";
import { RootState } from "../../../redux/store";
import { getFontSize, isJetBrains } from "../../../util";
import ApplyStateControls from "./ApplyButton";
import FileInfo from "./FileInfo";
import { isTerminalCodeBlock } from "./utils";

interface CodeBlockWithToolBarProps {
  text: string;
  bottom: boolean;
  language: string | undefined;
  isNextCodeBlock: boolean;
  filepath?: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isGenerating: boolean;
}

const CodeBlockWithToolBar = ({
  bottom,
  filepath,
  text,
  language,
  onToggleExpand,
  isGenerating,
  isExpanded,
}: CodeBlockWithToolBarProps) => {
  return "";
  // const dispatch = useDispatch();
  // const ideMessenger = useContext(IdeMessengerContext);
  // const defaultModel = useSelector(defaultModelSelector);
  // const streamIdRef = useRef<string | null>(null);

  // if (streamIdRef.current === null) {
  //   streamIdRef.current = uuidv4();
  // }

  // const applyState = useSelector(
  //   (store: RootState) =>
  //     store.uiState.applyStates.find(
  //       (state) => state.streamId === streamIdRef.current,
  //     )?.status ?? "closed",
  // );

  // const [isCopied, setIsCopied] = useState(false);

  // const isTerminal = isTerminalCodeBlock(language, text);

  // const onClickCopy = async () => {
  //   if (isJetBrains()) {
  //     await ideMessenger.request("copyText", { text });
  //   } else {
  //     await navigator.clipboard.writeText(text);
  //   }
  //   setIsCopied(true);
  //   setTimeout(() => setIsCopied(false), 2000);
  // };

  // async function onClickApply() {
  //   if (isTerminal) {
  //     await ideMessenger.ide.runCommand(text);
  //     return;
  //   }

  //   if (!filepath) return;

  //   dispatch(
  //     updateApplyState({
  //       streamId: streamIdRef.current,
  //       status: "streaming",
  //     }),
  //   );

  //   ideMessenger.post("applyToFile", {
  //     curSelectedModelTitle: defaultModel.title,
  //     text,
  //     streamId: streamIdRef.current,
  //     filepath,
  //   });
  // }

  // const onClickHeader = () => ideMessenger.post("showFile", { filepath });
  // const onClickAccept = () => ideMessenger.post("acceptDiff", { filepath });
  // const onClickReject = () => ideMessenger.post("rejectDiff", { filepath });

  // return (
  //   <div
  //     className={`flex items-center justify-between bg-inherit ${getFontSize() - 2}px border-b px-2 py-1 border-${lightGray}80 m-0`}
  //   >
  //     {filepath && (
  //       <FileInfo
  //         filepath={filepath}
  //         onToggleExpand={onToggleExpand}
  //         onClickHeader={onClickHeader}
  //         isExpanded={isExpanded}
  //       />
  //     )}

  //     <ApplyStateControls
  //       applyState={applyState}
  //       isGenerating={isGenerating}
  //       isCopied={isCopied}
  //       onClickCopy={onClickCopy}
  //       onClickApply={onClickApply}
  //       onClickAccept={onClickAccept}
  //       onClickReject={onClickReject}
  //     />
  //   </div>
  // );
};

export default CodeBlockWithToolBar;
