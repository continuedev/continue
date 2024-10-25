import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import AddModelForm from "../../forms/AddModelForm";
import {
  setDialogMessage,
  setShowDialog,
} from "../../redux/slices/uiStateSlice";
import { FREE_TRIAL_LIMIT_REQUESTS } from "../../util/freeTrial";
import { ToolTip } from "../gui/Tooltip";

interface FreeTrialProgressBarProps {
  completed: number;
  total: number;
}

function FreeTrialProgressBar({ completed, total }: FreeTrialProgressBarProps) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const fillPercentage = Math.min(100, Math.max(0, (completed / total) * 100));

  function onClick() {
    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <AddModelForm
          onDone={() => {
            dispatch(setShowDialog(false));
            navigate("/");
          }}
        />,
      ),
    );
  }

  if (completed > total) {
    return (
      <>
        <div
          className="flex items-center gap-1 cursor-default"
          data-tooltip-id="usage_progress_bar"
        >
          <ExclamationCircleIcon width="18px" height="18px" color="red" />
          Trial limit reached
        </div>

        <ToolTip id="usage_progress_bar" place="top">
          Configure a model above in order to continue
        </ToolTip>
      </>
    );
  }

  return (
    <>
      <div
        className="flex flex-col cursor-pointer text-gray-400 text-[10px]"
        data-tooltip-id="usage_progress_bar"
        onClick={onClick}
      >
        <div className="hidden xs:flex justify-between mb-0">
          <span>
            Free trial <span className="hidden sm:inline">requests</span>
          </span>

          <span>
            {completed} / {total}
          </span>
        </div>

        <div className="w-[40vw] h-1.5 rounded-md border border-gray-400 border-solid my-1.5 flex">
          <div
            className={`transition-all duration-200 ease-in-out h-full rounded-lg ${
              completed / total > 0.75 ? "bg-amber-500" : "bg-stone-500"
            }`}
            style={{
              width: `${fillPercentage}%`,
            }}
          />
        </div>
      </div>
      <ToolTip id="usage_progress_bar" place="top">
        {`Click to use your own API key or local LLM (required after ${FREE_TRIAL_LIMIT_REQUESTS} inputs)`}
      </ToolTip>
    </>
  );
}

export default FreeTrialProgressBar;
