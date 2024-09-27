import { IndexingProgressUpdate } from "core";
import { getProgressPercentage } from "./IndexingProgress";

export interface IndexingProgressBarProps {
  update: IndexingProgressUpdate;
}

function IndexingProgressBar({ update }: IndexingProgressBarProps) {
  const progressPercentage = getProgressPercentage(update.progress);

  return (
    <div className="w-full h-1.5 rounded-md border border-gray-400 border-solid my-2">
      <div
        className={`transition-all duration-200 ease-in-out h-full rounded-lg ${
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
