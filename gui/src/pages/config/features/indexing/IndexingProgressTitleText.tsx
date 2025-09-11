import { IndexingProgressUpdate } from "core";
import { AnimatedEllipsis } from "../../../../components/AnimatedEllipsis";

export interface IndexingProgressTitleTextProps {
  update: IndexingProgressUpdate;
}

const STATUS_TO_TEXT: Record<IndexingProgressUpdate["status"], string> = {
  done: "Indexing complete",
  loading: "Initializing",
  waiting: "Indexing other workspace",
  indexing: "Indexing in-progress",
  paused: "Indexing paused",
  failed: "Indexing failed",
  disabled: "Indexing disabled",
  cancelled: "Indexing cancelled",
};

function IndexingProgressTitleText({ update }: IndexingProgressTitleTextProps) {
  const showEllipsis = update.status === "loading";

  return (
    <span>
      {STATUS_TO_TEXT[update.status]}
      {showEllipsis && <AnimatedEllipsis />}
    </span>
  );
}

export default IndexingProgressTitleText;
