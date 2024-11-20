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
      className="hover: mb-[0.25em] inline-flex cursor-pointer flex-row items-center gap-[0.2rem] align-middle hover:opacity-70"
      onClick={onClick}
    >
      <code className="align-middle underline underline-offset-2">
        {content}
      </code>
    </span>
  );
}

export default SymbolLink;
