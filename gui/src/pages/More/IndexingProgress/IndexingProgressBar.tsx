import { IndexingProgressUpdate } from "core";
import { getProgressPercentage } from "./IndexingProgress";

export interface IndexingProgressBarProps {
  update: IndexingProgressUpdate;
}

function IndexingProgressBar({ update }: IndexingProgressBarProps) {
  const progressPercentage = getProgressPercentage(update.progress);

  return (
    <div className="border-border my-2 h-1.5 w-full rounded-md border border-solid">
      <div
        className={`h-full rounded-lg transition-all duration-200 ease-in-out ${
          update.status === "failed" ? "bg-error" : "bg-vsc-editor-background"
        }`}
        style={{
          width: `${progressPercentage}%`,
        }}
      />
    </div>
  );
}

export default IndexingProgressBar;
