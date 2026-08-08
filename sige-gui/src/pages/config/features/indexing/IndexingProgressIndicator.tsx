import {
  ArrowPathIcon,
  CheckCircleIcon,
  PauseCircleIcon,
} from "@heroicons/react/24/outline";
import { IndexingProgressUpdate } from "core";
import { getProgressPercentage } from "./IndexingProgress";

export interface IndexingProgressIndicatorProps {
  update: IndexingProgressUpdate;
}

const STATUS_TO_ICON: Record<IndexingProgressUpdate["status"], any> = {
  disabled: null,
  loading: null,
  waiting: null,
  indexing: ArrowPathIcon,
  paused: PauseCircleIcon,
  done: CheckCircleIcon,
  failed: null, // Since we show an erorr message below
  cancelled: null,
};

function IndexingProgressIndicator({ update }: IndexingProgressIndicatorProps) {
  const progressPercentage = getProgressPercentage(update.progress).toFixed(0);
  const Icon = STATUS_TO_ICON[update.status];
  const animateIcon = update.status === "indexing";
  const showProgress =
    update.status !== "disabled" && progressPercentage !== "100";

  return (
    <div className="text-lightgray flex items-center justify-between gap-1">
      {showProgress && <span className="text-xs">{progressPercentage}%</span>}

      {Icon && (
        <div className="flex items-center">
          <Icon
            className={`text-lightgray inline-block h-4 w-4 align-top ${
              animateIcon ? "animate-spin-slow" : ""
            }`}
          ></Icon>
        </div>
      )}
    </div>
  );
}

export default IndexingProgressIndicator;
