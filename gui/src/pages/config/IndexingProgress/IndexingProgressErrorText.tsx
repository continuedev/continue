import { XCircleIcon } from "@heroicons/react/24/outline";
import { IndexingProgressUpdate } from "core";
import { useAppSelector } from "../../../redux/hooks";

export interface IndexingProgressErrorTextProps {
  update: IndexingProgressUpdate;
}

function IndexingProgressErrorText({ update }: IndexingProgressErrorTextProps) {
  const embeddingsProvider = useAppSelector(
    (state) => state.config.config.selectedModelByRole.embed,
  );

  if (!embeddingsProvider) {
    return (
      <div className="flex items-center gap-2 italic">
        <XCircleIcon className="h-4 w-4 min-w-[10%]" />
        <span className="leading-relaxed">
          Add an Embeddings model to enable codebase indexing. See the docs for
          examples:
          <a
            href="https://docs.continue.dev/walkthroughs/codebase-embeddings#embeddings-providers"
            target="_blank"
            className="cursor-pointer text-inherit underline hover:text-inherit"
          >
            https://docs.continue.dev/walkthroughs/codebase-embeddings#embeddings-providers
          </a>
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 italic">
      <XCircleIcon className="h-4 w-4" />
      <span className="leading-relaxed">{update.desc}</span>
    </div>
  );
}

export default IndexingProgressErrorText;
