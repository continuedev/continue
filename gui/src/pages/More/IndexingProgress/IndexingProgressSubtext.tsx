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
  indexing: "Click to pause",
  paused: "Click to resume",
  failed: "Click to retry",
  disabled: "Click to open config.json and enable indexing (requires reload)",
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
        className={`text-description cursor-pointer text-xs underline ${
          showIndexingDesc ? "w-1/3" : "w-full"
        }`}
        onClick={onClick}
      >
        {STATUS_TO_SUBTITLE_TEXT[update.status]}
      </span>

      {showIndexingDesc && (
        <span className="text-description w-2/3 truncate text-right text-xs">
          {update.desc}
        </span>
      )}
    </div>
  );
}

export default IndexingProgressSubtext;
