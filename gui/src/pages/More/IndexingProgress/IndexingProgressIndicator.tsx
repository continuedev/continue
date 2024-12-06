import { IndexingProgressUpdate } from "core";
import { getProgressPercentage } from "./IndexingProgress";
import {
  ArrowPathIcon,
  PauseCircleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

export interface IndexingProgressIndicatorProps {
  update: IndexingProgressUpdate;
}

const STATUS_TO_ICON: Record<IndexingProgressUpdate["status"], any> = {
  disabled: null,
  loading: null,
  indexing: ArrowPathIcon,
  paused: PauseCircleIcon,
  done: CheckCircleIcon,
  failed: null, // Since we show an erorr message below
  cancelled: null,
};

function IndexingProgressIndicator({ update }: IndexingProgressIndicatorProps) {
  const progressPercentage = getProgressPercentage(update.progress);
  const Icon = STATUS_TO_ICON[update.status];
  const animateIcon = update.status === "indexing";
  const showProgress = update.status !== "disabled";

  return (
    <div className="flex items-center justify-between gap-1 text-stone-500">
      {showProgress && (
        <span className="text-xs">{progressPercentage.toFixed(0)}%</span>
      )}

      {Icon && (
        <div className="flex items-center">
          <Icon
            className={`inline-block h-4 w-4 align-top text-stone-500 ${
              animateIcon ? "animate-spin-slow" : ""
            }`}
          ></Icon>
        </div>
      )}
    </div>
  );
}

export default IndexingProgressIndicator;
