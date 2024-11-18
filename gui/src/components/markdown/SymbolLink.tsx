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
      className="mb-0.5 inline-flex cursor-pointer items-center gap-0.5 rounded-md py-0.5 pl-0 align-middle hover:bg-stone-800"
      onClick={onClick}
    >
      <code className="align-middle underline decoration-gray-600 underline-offset-2">
        {content}
      </code>
    </span>
  );
}

export default SymbolLink;
