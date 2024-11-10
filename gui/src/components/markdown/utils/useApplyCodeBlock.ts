import { useContext } from "react";
import { useDispatch, useSelector } from "react-redux";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import {
  incrementNextCodeBlockToApplyIndex,
  updateApplyState,
} from "../../../redux/slices/uiStateSlice";
import { defaultModelSelector } from "../../../redux/selectors/modelSelectors";

export interface useApplyCodeBlock {
  streamId: string;
  filepath?: string;
  codeBlockContent: string;
}

export function useApplyCodeBlock({
  streamId,
  filepath,
  codeBlockContent,
}: useApplyCodeBlock) {
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const defaultModel = useSelector(defaultModelSelector);

  const applyCodeBlock = async () => {
    dispatch(
      updateApplyState({
        streamId,
        filepath,
        status: "streaming",
      }),
    );

    await ideMessenger.request("applyToFile", {
      text: codeBlockContent,
      streamId,
      curSelectedModelTitle: defaultModel.title,
      filepath,
    });

    dispatch(incrementNextCodeBlockToApplyIndex({}));
  };

  return applyCodeBlock;
}
