import { SymbolWithRange } from "core";
import { useContext, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { ToolTip } from "../gui/Tooltip";

interface SymbolLinkProps {
  symbol: SymbolWithRange;
  content: string;
}

function SymbolLink({ symbol, content }: SymbolLinkProps) {
  const ideMessenger = useContext(IdeMessengerContext);

  function onClick() {
    ideMessenger.post("showLines", {
      filepath: symbol.filepath,
      startLine: symbol.range.start.line,
      endLine: symbol.range.end.line,
    });
  }

  const processedContent = useMemo(() => {
    let content = symbol.content;
    // TODO Normalize indentation
    // let lines = symbol.content.split("\n");
    // if (lines.length > 1) {
    //   const firstLineIndentation = lines[0].match(/^\s*/)?.[0].length || 0;
    //   content = lines
    //     .map((line) => line.slice(firstLineIndentation))
    //     .join("\n");
    // }

    // Truncate
    return content.length > 200 ? content.slice(0, 196) + "\n..." : content;
  }, [symbol]);

  const id = uuidv4();
  return (
    <>
      <span
        className="mx-[0.1em] mb-[0.15em] inline-flex cursor-pointer flex-row items-center gap-[0.2rem] rounded-md align-middle hover:ring-1"
        onClick={onClick}
        data-tooltip-id={id}
        data-tooltip-delay-show={500}
      >
        <code className="align-middle underline underline-offset-2">
          {content}
        </code>
      </span>
      <ToolTip id={id} place="top" className="m-0 p-0">
        <pre className="text-left">{processedContent ?? symbol.filepath}</pre>
      </ToolTip>
    </>
  );
}

export default SymbolLink;
