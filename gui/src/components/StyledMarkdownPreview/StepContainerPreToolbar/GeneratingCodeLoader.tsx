import Spinner from "../../gui/Spinner";

export interface GeneratingCodeLoaderProps {
  showLineCount: boolean;
  codeBlockContent: string;
}

export function GeneratingCodeLoader({
  showLineCount,
  codeBlockContent,
}: GeneratingCodeLoaderProps) {
  const numLinesCodeBlock = codeBlockContent.split("\n").length;
  const linesGeneratedText =
    numLinesCodeBlock === 1
      ? `1 line generated`
      : `${numLinesCodeBlock} lines generated`;

  return (
    <span className="text-lightgray inline-flex items-center gap-2">
      {showLineCount ? linesGeneratedText : "Generating"}
      <Spinner />
    </span>
  );
}
