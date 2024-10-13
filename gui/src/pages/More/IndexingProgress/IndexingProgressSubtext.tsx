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
};

function IndexingProgressSubtext({
  update,
  onClick,
}: IndexingProgressSubtextProps) {
  const showIndexingDesc = update.status === "indexing";

  return (
    <div className="flex justify-between">
      <span
        className={`text-xs text-stone-500 underline cursor-pointer text-stone-500 ${
          showIndexingDesc ? "w-1/3" : "w-full"
        }`}
        onClick={onClick}
      >
        {STATUS_TO_SUBTITLE_TEXT[update.status]}
      </span>

      {showIndexingDesc && (
        <span className="text-xs text-stone-500 truncate w-2/3 text-right">
          {update.desc}
        </span>
      )}
    </div>
  );
}

export default IndexingProgressSubtext;
