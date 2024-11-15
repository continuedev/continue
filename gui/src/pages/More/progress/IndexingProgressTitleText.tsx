import { IndexingProgressUpdate } from "core";
import { AnimatedEllipsis } from "../../../components";
import { STATUS_TO_TEXT } from ".";

export interface IndexingProgressTitleTextProps {
  update: IndexingProgressUpdate;
}

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
