import Spinner from "../../gui/Spinner";

export interface GeneratingCodeLoaderProps {
  showLineCount: boolean;
  codeBlockContent: string;
  isPending: boolean;
}

export function GeneratingCodeLoader({
  showLineCount,
  codeBlockContent,
  isPending,
}: GeneratingCodeLoaderProps) {
  const numLinesCodeBlock = codeBlockContent.split("\n").length;
  const linesGeneratedText =
    numLinesCodeBlock === 1
      ? `1 line generated`
      : `${numLinesCodeBlock} lines ${isPending ? "pending" : "generated"}`;

  return (
    <span className="text-lightgray inline-flex items-center gap-2">
      {showLineCount ? linesGeneratedText : "Generating"}
      {!isPending && <Spinner />}
    </span>
  );
}
