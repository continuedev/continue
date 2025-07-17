import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { saveCurrentSession } from "../../redux/thunks/session";
import { ToolTip } from "../gui/Tooltip";

const ContextStatus = () => {
  const dispatch = useAppDispatch();
  const contextPercentage = useAppSelector(
    (state) => state.session.contextPercentage,
  );
  const percent = Math.round((contextPercentage ?? 0) * 100);
  const isPruned = useAppSelector((state) => state.session.isPruned);
  if (!isPruned && percent < 60) {
    return null;
  }
  return (
    <div className="text-description-muted my-0.5 flex flex-row items-center gap-2 text-xs">
      <span
        className="cursor-pointer underline"
        onClick={() => {
          dispatch(
            saveCurrentSession({
              openNewSession: true,
              generateTitle: false,
            }),
          );
        }}
      >
        New Session
      </span>
      {contextPercentage !== undefined && (
        <>
          <span data-tooltip-id="percent-tooltip">{percent}%</span>
          <ToolTip id="percent-tooltip">
            {`${percent}% of context is filled`}
          </ToolTip>
        </>
      )}

      {isPruned && (
        <>
          <div
            data-tooltip-id="prune-tooltip"
            className="bg-warning h-2 w-2 rounded-full"
          ></div>
          <ToolTip id="prune-tooltip">
            Chat history exceeds context limit, old messages are being removed
          </ToolTip>
        </>
      )}
    </div>
  );
};

export default ContextStatus;
