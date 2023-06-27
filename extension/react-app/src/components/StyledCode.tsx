import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus as highlightStyle } from "react-syntax-highlighter/dist/esm/styles/prism";

interface StyledCodeProps {
  children: string;
  language?: string;
}

const StyledCode = (props: StyledCodeProps) => (
  <SyntaxHighlighter
    customStyle={{ margin: "0" }}
    style={highlightStyle}
    language={props.language || "python"}
  >
    {(props.children as any).props.children}
  </SyntaxHighlighter>
);

export default StyledCode;
