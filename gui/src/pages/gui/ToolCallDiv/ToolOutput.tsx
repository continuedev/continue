import { ContextItemWithId } from "core";
import { ComponentType } from "react";
import ContextItemsPeek from "../../../components/mainInput/belowMainInput/ContextItemsPeek";

interface ToolOutputProps {
  contextItems: ContextItemWithId[];
  toolCallId: string;
  icon?: ComponentType;
  title?: JSX.Element | string;
}

function ToolOutput(props: ToolOutputProps) {
  // Terminal has dedicated UI to show the output
  if (props.contextItems.some((ci) => ci.name === "Terminal")) {
    return null;
  }

  return (
    <div>
      <ContextItemsPeek
        showWhenNoResults={true}
        title={props.title}
        icon={props.icon}
        isCurrentContextPeek={false}
        contextItems={props.contextItems}
      />
    </div>
  );
}

export default ToolOutput;
