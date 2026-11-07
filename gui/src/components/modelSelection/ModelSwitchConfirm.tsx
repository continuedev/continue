import { useDispatch } from "react-redux";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";
import { useAppDispatch } from "../../redux/hooks";
import { saveCurrentSession } from "../../redux/thunks/session";
import type { CacheLoss } from "../../util/cacheSafeguards";
import { formatRereadCost } from "../../util/cacheNotices";
import { Button } from "../ui/Button";

/**
 * Asked before switching models while the prompt cache is warm and the
 * conversation is large: each model has its own cache, so the whole
 * conversation is read again at the write price.
 */
export function ModelSwitchConfirm(props: {
  from: string;
  to: string;
  loss: CacheLoss;
  /** Switches the model; the conversation stays and is re-read. */
  onSwitch: () => void;
  /** Switches the model in a new, empty session. */
  onSwitchInNewSession: () => void;
}) {
  const dispatch = useDispatch();
  const appDispatch = useAppDispatch();
  const close = () => {
    dispatch(setShowDialog(false));
    dispatch(setDialogMessage(undefined));
  };
  return (
    <div className="p-4 pt-0" data-testid="model-switch-confirm">
      <h1 className="mb-1 text-center text-xl">Switch model?</h1>
      <p className="text-center text-base">
        Each model has its own prompt cache. Switching from {props.from} to{" "}
        {props.to} re-reads {formatRereadCost(props.loss)}.
      </p>
      <p className="text-center text-sm text-description">
        A new session starts empty, so it costs nothing to re-read. Your current
        session is saved.
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          onClick={close}
          data-testid="model-switch-cancel"
        >
          Cancel
        </Button>
        <Button
          variant="outline"
          data-testid="model-switch-new-session"
          onClick={() => {
            close();
            void appDispatch(
              saveCurrentSession({
                openNewSession: true,
                generateTitle: false,
              }),
            ).then(() => props.onSwitchInNewSession());
          }}
        >
          Switch in a new session
        </Button>
        <Button
          data-testid="model-switch-anyway"
          onClick={() => {
            close();
            props.onSwitch();
          }}
        >
          Switch anyway
        </Button>
      </div>
    </div>
  );
}
