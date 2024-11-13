import { useContext, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { IdeMessengerContext } from "../context/IdeMessenger";
import {
  incrementNextCodeBlockToApplyIndex,
  updateApplyState,
} from "../redux/slices/stateSlice";
import { defaultModelSelector } from "../redux/selectors/modelSelectors";
import { v4 as uuidv4 } from "uuid";

export interface useApplyCodeBlockParams {
  codeBlockContent: string;
  streamId?: string;
  filepath?: string;
  overwriteFileContents?: boolean;
}

export function useApplyCodeBlock() {
  const dispatch = useDispatch();
  const streamIdRef = useRef<string>(uuidv4());
  const ideMessenger = useContext(IdeMessengerContext);
  const defaultModel = useSelector(defaultModelSelector);

  const applyCodeBlock = async ({
    streamId,
    filepath,
    codeBlockContent,
    overwriteFileContents,
  }: useApplyCodeBlockParams) => {
    dispatch(
      updateApplyState({
        filepath,
        // When reverting to a checkpoint, we don't have a pre-existing streamId
        streamId: streamId ?? streamIdRef.current,
        status: "streaming",
      }),
    );

    await ideMessenger.request("applyToFile", {
      streamId,
      filepath,
      overwriteFileContents,
      text: codeBlockContent,
      curSelectedModelTitle: defaultModel.title,
    });

    dispatch(incrementNextCodeBlockToApplyIndex({}));
  };

  return applyCodeBlock;
}
