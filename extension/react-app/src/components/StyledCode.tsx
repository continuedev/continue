import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { synthwave84 } from "react-syntax-highlighter/dist/esm/styles/prism";

interface StyledCodeProps {
    children: string;
}

const StyledCode = (props: (StyledCodeProps)) => (
  <SyntaxHighlighter style={synthwave84}>
    {props.children}
  </SyntaxHighlighter>
);

export default StyledCode;