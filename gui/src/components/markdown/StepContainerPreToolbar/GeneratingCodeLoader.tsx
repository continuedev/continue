import Spinner from "./Spinner";

export interface GeneratingCodeLoaderProps {
  showLineCount: boolean;
  codeBlockContent: string;
}

export default function GeneratingCodeLoader({
  showLineCount,
  codeBlockContent,
}: GeneratingCodeLoaderProps) {
  const numLinesCodeBlock = codeBlockContent.split("\n").length;
  const linesGeneratedText =
    numLinesCodeBlock === 1
      ? `1 line generated`
      : `${numLinesCodeBlock} lines generated`;

  return (
    <span className="inline-flex items-center gap-2 text-gray-400">
      {showLineCount ? linesGeneratedText : "Generating..."}
      <Spinner />
    </span>
  );
}
