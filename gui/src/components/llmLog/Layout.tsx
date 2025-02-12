import { useState } from "react";
import useLLMLog from "../../hooks/useLLMLog";
import Details from "./Details";
import List from "./List";

export default function Layout() {
  const llmLog = useLLMLog();

  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const interaction = selectedId
    ? llmLog.interactions.get(selectedId)
    : undefined;

  return llmLog.loading ? (
    <div>Loading...</div>
  ) : (
    <div className="flex h-full w-full">
      <List
        llmLog={llmLog}
        onClickInteraction={(interactionId) => {
          setSelectedId(interactionId);
        }}
      ></List>
      {interaction && (
        <Details key="{selectedId}" interaction={interaction}></Details>
      )}
    </div>
  );
}
