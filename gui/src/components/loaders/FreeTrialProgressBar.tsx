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
          className="flex cursor-default items-center gap-1"
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
        className="flex cursor-pointer flex-col text-[10px] text-gray-400"
        data-tooltip-id="usage_progress_bar"
        onClick={onClick}
      >
        <div className="xs:flex mb-0 hidden justify-between">
          <span>
            Free trial <span className="hidden sm:inline">requests</span>
          </span>

          <span>
            {completed} / {total}
          </span>
        </div>

        <div className="my-1.5 flex h-1.5 w-[40vw] rounded-md border border-solid border-gray-400">
          <div
            className={`h-full rounded-lg transition-all duration-200 ease-in-out ${
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
