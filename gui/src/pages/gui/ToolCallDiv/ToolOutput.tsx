import ContextItemsPeek from "../../../components/mainInput/ContextItemsPeek";

interface ToolOutputProps {
  output: string;
  toolCallId: string;
}

function ToolOutput(props: ToolOutputProps) {
  if (
    props.output === undefined ||
    props.output === null ||
    props.output.trim() === ""
  ) {
    return null;
  }
  return (
    <div>
      <ContextItemsPeek
        isCurrentContextPeek={false}
        contextItems={[
          {
            content: props.output,
            name: "Tool Call",
            id: {
              itemId: props.toolCallId,
              providerTitle: "tool-call",
            },
            description: "Tool Call",
          },
        ]}
      />
    </div>
  );
}

export default ToolOutput;
