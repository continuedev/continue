import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { saveCurrentSession } from "../../redux/thunks/session";
import { useCompactConversation } from "../../util/compactConversation";
import { ToolTip } from "../gui/Tooltip";

const ContextStatus = () => {
  const dispatch = useAppDispatch();
  const contextPercentage = useAppSelector(
    (state) => state.session.contextPercentage,
  );
  const history = useAppSelector((state) => state.session.history);
  const percent = Math.round((contextPercentage ?? 0) * 100);
  const isPruned = useAppSelector((state) => state.session.isPruned);

  const compactConversation = useCompactConversation();
  if (!isPruned && percent < 60) {
    return null;
  }

  const barColorClass = isPruned
    ? "bg-error"
    : percent > 80
      ? "bg-warning"
      : "bg-description";

  return (
    <div>
      <ToolTip
        id="context-status"
        closeEvents={{
          // blur: false,
          mouseleave: true,
          click: true,
          mouseup: false,
        }}
        clickable
      >
        <div className="flex flex-col gap-0 text-xs">
          <span className="inline-block">
            {`${percent}% of context filled`}
          </span>
          {isPruned && (
            <span className="inline-block">
              {`Oldest messages are being removed`}
            </span>
          )}
          {history.length > 0 && (
            <div className="flex flex-col gap-1 whitespace-pre">
              <div>
                <span
                  className="inline-block cursor-pointer underline"
                  onClick={() => compactConversation(history.length - 1)}
                >
                  Compact conversation
                </span>
                {"\n"}
                <span className="inline-block">or</span> {"\n"}
                <span
                  className="inline-block cursor-pointer underline"
                  onClick={() => {
                    dispatch(
                      saveCurrentSession({
                        openNewSession: true,
                        generateTitle: false,
                      }),
                    );
                  }}
                >
                  Start a new session
                </span>
              </div>
            </div>
          )}
        </div>
      </ToolTip>
      <div
        data-tooltip-id="context-status"
        className="border-description-muted relative h-[14px] w-[7px] rounded-[1px] border-[0.5px] border-solid md:h-[10px] md:w-[5px]"
      >
        <div
          className={`transition-height absolute bottom-0 left-0 w-full duration-300 ease-in-out ${barColorClass}`}
          style={{ height: `${percent}%` }}
        ></div>
      </div>
    </div>
  );
};

export default ContextStatus;
