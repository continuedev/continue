import { Tooltip } from "react-tooltip";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { saveCurrentSession } from "../../redux/thunks/session";

const ContextStatus = () => {
  const dispatch = useAppDispatch();
  const contextPercentage = useAppSelector(
    (state) => state.session.contextPercentage,
  );
  const history = useAppSelector((state) => state.session.history);
  const percent = Math.round((contextPercentage ?? 0) * 100);
  const isPruned = useAppSelector((state) => state.session.isPruned);
  if (!isPruned && percent < 60) {
    return null;
  }

  const barColorClass = percent > 80 ? "bg-warning" : "bg-description";

  return (
    <div>
      <Tooltip
        id="context-status"
        closeEvents={{
          // blur: false,
          mouseleave: true,
          click: true,
          mouseup: false,
        }}
        clickable
      >
        <div className="flex flex-col gap-0">
          <span> {`${percent}% of context filled`}</span>
          {isPruned && <span>Old messages are being removed</span>}
          {history.length > 0 && (
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
          )}
        </div>
      </Tooltip>
      <div
        data-tooltip-id="context-status"
        className="border-description-muted relative h-[10px] w-[5px] rounded-[1px] border-[0.5px] border-solid"
      >
        {/* <div className="absolute bottom-full left-1/4 h-[1px] w-1/2 border-[0.5px] border-solid" /> */}
        <div
          className={`transition-height absolute bottom-0 left-0 w-full duration-300 ease-in-out ${barColorClass}`}
          style={{ height: `${percent}%` }}
        ></div>
      </div>
    </div>
  );
};

export default ContextStatus;
