import { SymbolWithRange } from "core";
import { useContext } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";

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

  return (
    <span
      className="mx-[0.1em] mb-[0.15em] inline-flex cursor-pointer flex-row items-center gap-[0.2rem] rounded-md align-middle hover:ring-1"
      onClick={onClick}
    >
      <code className="align-middle underline underline-offset-2">
        {content}
      </code>
    </span>
  );
}

export default SymbolLink;
