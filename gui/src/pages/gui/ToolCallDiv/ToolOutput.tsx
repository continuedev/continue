import { ContextItemWithId } from "core";
import ContextItemsPeek from "../../../components/mainInput/belowMainInput/ContextItemsPeek";

interface ToolOutputProps {
  contextItems: ContextItemWithId[];
  toolCallId: string;
}

function ToolOutput(props: ToolOutputProps) {
  // Terminal has dedicated UI to show the output
  if (props.contextItems.some((ci) => ci.name === "Terminal")) {
    return null;
  }

  return (
    <div>
      <ContextItemsPeek
        isCurrentContextPeek={false}
        contextItems={props.contextItems}
      />
    </div>
  );
}

export default ToolOutput;
