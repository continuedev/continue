import { IndexingProgressUpdate } from "core";
import { getProgressPercentage } from "./IndexingProgress";

export interface IndexingProgressBarProps {
  update: IndexingProgressUpdate;
}

function IndexingProgressBar({ update }: IndexingProgressBarProps) {
  // Show 100% red progress bar if indexing failed
  const progressPercentage =
    update.status === "failed" ? 100 : getProgressPercentage(update.progress);

  return (
    <div className="my-2 h-1.5 w-full rounded-md border border-solid border-gray-400">
      <div
        className={`h-full rounded-lg transition-all duration-200 ease-in-out ${
          update.status === "failed" ? "bg-red-600" : "bg-stone-500"
        }`}
        style={{
          width: `${progressPercentage}%`,
        }}
      />
    </div>
  );
}

export default IndexingProgressBar;
