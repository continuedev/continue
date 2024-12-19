import { ContextItemWithId } from "core";
import ContextItemsPeek from "../../../components/mainInput/ContextItemsPeek";

interface ToolOutputProps {
  contextItems: ContextItemWithId[];
  toolCallId: string;
}

function ToolOutput(props: ToolOutputProps) {
  if (props.contextItems.length === 0) {
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
