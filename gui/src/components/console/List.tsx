import { useEffect, useRef, useState } from "react";
import { LLMLog } from "../../hooks/useLLMLog";
import ListItem from "./ListItem";

export interface ListProps {
  llmLog: LLMLog;
  onClickInteraction: (interactionId: string) => void;
}

export default function List({ llmLog, onClickInteraction }: ListProps) {
  const topRef = useRef<HTMLUListElement>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const lastSize = useRef(0);

  useEffect(() => {
    if (llmLog.order.length != lastSize.current) {
      setSelectedId(llmLog.order[llmLog.order.length - 1]);
      onClickInteraction(llmLog.order[llmLog.order.length - 1]);

      lastSize.current = llmLog.order.length;
      const lastChild = topRef.current?.lastChild;
      if (lastChild) {
        (lastChild as HTMLElement).scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      }
    }
  });

  return (
    <ul
      tabIndex={1}
      ref={topRef}
      className="group m-0 w-[150px] flex-none list-none overflow-auto border-0 border-r-2 border-solid border-[color:var(--vscode-panel-border)] p-0"
    >
      {llmLog.order.map((id) => (
        <ListItem
          key={id}
          interactionId={id}
          interaction={llmLog.interactions.get(id)!}
          onClickInteraction={(interactionId) => {
            topRef.current?.focus();
            setSelectedId(interactionId);
            onClickInteraction(interactionId);
          }}
          selected={id == selectedId}
        ></ListItem>
      ))}
    </ul>
  );
}
