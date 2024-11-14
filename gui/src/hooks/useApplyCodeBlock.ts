import { useContext } from "react";
import { useDispatch, useSelector } from "react-redux";
import { IdeMessengerContext } from "../context/IdeMessenger";
import {
  incrementNextCodeBlockToApplyIndex,
  updateApplyState,
} from "../redux/slices/stateSlice";
import { defaultModelSelector } from "../redux/selectors/modelSelectors";

export interface useApplyCodeBlockParams {
  codeBlockContent: string;
  streamId?: string;
  filepath?: string;
}

export function useApplyCodeBlock() {
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const defaultModel = useSelector(defaultModelSelector);

  const applyCodeBlock = async ({
    streamId,
    filepath,
    codeBlockContent,
  }: useApplyCodeBlockParams) => {
    dispatch(
      updateApplyState({
        filepath,
        streamId,
        status: "streaming",
      }),
    );

    await ideMessenger.request("applyToFile", {
      streamId,
      filepath,
      text: codeBlockContent,
      curSelectedModelTitle: defaultModel.title,
    });

    dispatch(incrementNextCodeBlockToApplyIndex({}));
  };

  return applyCodeBlock;
}
