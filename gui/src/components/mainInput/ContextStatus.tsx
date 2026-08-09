import { useMemo, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { saveCurrentSession } from "../../redux/thunks/session";
import { useCompactConversation } from "../../util/compactConversation";
import { ToolTip } from "../gui/Tooltip";

const ContextStatus = () => {
  const dispatch = useAppDispatch();
  const contextPercentage = useAppSelector(
    (state) => state.session.contextPercentage,
  );
  const selectedChatModel = useAppSelector(
    (state) => state.config.config.selectedModelByRole.chat?.model,
  );
  const previousHistoryLength = useRef<number | null>(null);
  const previousSelectedChatModel = useRef<string | null>(null);
  const history = useAppSelector((state) => state.session.history);
  const isPruned = useAppSelector((state) => state.session.isPruned);

  // contextPercentage is undefined until the first message is sent
  // (it's only computed in compileChatMessages during streamNormalInput)
  const hasContextData = contextPercentage !== undefined;

  // Format: show 1 decimal place when < 1%, integer otherwise
  const displayPercent = hasContextData
    ? contextPercentage * 100
    : 0;
  const percentFormatted = hasContextData
    ? displayPercent < 1
      ? displayPercent.toFixed(1)
      : Math.round(displayPercent).toString()
    : "—";
  const percent = hasContextData ? Math.round(displayPercent) : 0;

  const isDifferentModelAndSameHistory = useMemo(() => {
    if (!selectedChatModel) return false;
    // only reset if history changes
    if (previousHistoryLength.current !== history.length) {
      previousHistoryLength.current = history.length;
      previousSelectedChatModel.current = selectedChatModel;
      return false;
    }
    return previousSelectedChatModel.current !== selectedChatModel;
  }, [history.length, selectedChatModel]);

  const compactConversation = useCompactConversation();

  // Always show context usage when there's history, regardless of percentage
  // Previously: if (!isPruned && percent < 60) return null;
  if (history.length === 0) {
    return null;
  }

  // if user changed to a different model, we shouldn't show the context status until the user sends a new message
  if (isDifferentModelAndSameHistory) {
    return null;
  }

  const barColorClass = isPruned
    ? "bg-error"
    : percent >= 80
      ? "bg-warning"
      : percent >= 60
        ? "bg-description"
        : "bg-description-muted";

  return (
    <div className="flex items-center gap-1">
      <ToolTip
        closeEvents={{
          mouseleave: true,
          click: true,
          mouseup: false,
        }}
        clickable
        content={
          <div className="flex flex-col gap-0 text-left text-xs">
            <span className="inline-block">
              {hasContextData
                ? `${percentFormatted}% of context filled.`
                : `Context usage will be shown after sending a message.`}
            </span>
            {isPruned && (
              <span className="inline-block">
                {`Oldest messages are being removed.`}
              </span>
            )}
            {history.length > 0 && (
              <div className="flex flex-col gap-1 whitespace-pre">
                <div>
                  <span
                    className="hover:text-link inline-block cursor-pointer underline"
                    onClick={() => compactConversation(history.length - 1)}
                  >
                    Compact conversation
                  </span>
                  {"\n"}
                  <span
                    className="hover:text-link inline-block cursor-pointer underline"
                    onClick={() => {
                      void dispatch(
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
        }
      >
        <div className="border-command-border relative h-[14px] w-[7px] rounded-[1px] border-[0.5px] border-solid md:h-[10px] md:w-[5px]">
          <div
            className={`transition-height absolute bottom-0 left-0 w-full duration-300 ease-in-out ${barColorClass}`}
            style={{ height: `${hasContextData ? Math.max(percent, 2) : 0}%` }}
          />
        </div>
      </ToolTip>
      <span
        className={`text-description-muted hidden select-none text-[10px] leading-none xs:inline ${percent >= 80 ? "text-warning" : percent >= 60 ? "text-description" : "text-description-muted"}`}
      >
        {hasContextData ? `${percentFormatted}%` : "—"}
      </span>
    </div>
  );
};

export default ContextStatus;
