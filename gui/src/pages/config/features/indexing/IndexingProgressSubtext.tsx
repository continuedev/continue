import { IndexingProgressUpdate } from "core";

export interface IndexingProgressSubtextProps {
  update: IndexingProgressUpdate;
  onClick: () => void;
}

const STATUS_TO_SUBTITLE_TEXT: Record<
  IndexingProgressUpdate["status"],
  string | undefined
> = {
  done: "Click to re-index",
  loading: "",
  waiting: "",
  indexing: "Click to pause",
  paused: "Click to resume",
  failed: "Click to retry",
  disabled: "Click to open configuration",
  cancelled: "Click to restart",
};

function IndexingProgressSubtext({
  update,
  onClick,
}: IndexingProgressSubtextProps) {
  const showIndexingDesc = update.status === "indexing";

  return (
    <div className="flex justify-between">
      <span
        className={`text-lightgray inline-block cursor-pointer text-xs underline`}
        onClick={onClick}
      >
        {STATUS_TO_SUBTITLE_TEXT[update.status]}
      </span>

      <div className={`${showIndexingDesc ? "w-2/3" : "flex-1"}`}>
        {showIndexingDesc && (
          <span className="text-lightgray block truncate text-right text-xs">
            {update.desc}
          </span>
        )}
      </div>
    </div>
  );
}

export default IndexingProgressSubtext;
