import {
  LLMInteractionStartChat,
  LLMInteractionStartComplete,
  LLMInteractionStartFim,
} from "core";
import Expander from "./Expander";
import Message from "./Message";

export interface StartProps {
  item:
    | LLMInteractionStartChat
    | LLMInteractionStartComplete
    | LLMInteractionStartFim;
}

export default function Start({ item }: StartProps) {
  return (
    <div className="border-0 border-b-2 border-solid border-[color:var(--vscode-panel-border)] p-1">
      {(() => {
        switch (item.kind) {
          case "startChat":
            return (
              <>
                <Expander label="Prompt">
                  <div className="p-1">
                    {item.messages.map((message, i) => (
                      <Message key={i} message={message}></Message>
                    ))}
                  </div>
                </Expander>
                <Expander label="Options">
                  <pre className="m-0">
                    {JSON.stringify(item.options, undefined, 2)}
                  </pre>
                </Expander>
              </>
            );
            break;
          case "startComplete":
            return (
              <>
                <Expander label="Prompt">
                  <pre className="m-0">{item.prompt}</pre>
                </Expander>
                <Expander label="Options">
                  <pre className="m-0">
                    {JSON.stringify(item.options, undefined, 2)}
                  </pre>
                </Expander>
              </>
            );
            break;
          case "startFim":
            return (
              <>
                <Expander label="Prefix">
                  <pre className="m-0">{item.prefix}</pre>
                </Expander>
                <Expander label="Suffix">
                  <pre className="m-0">{item.suffix}</pre>
                </Expander>
                <Expander label="Options">
                  <pre className="m-0">
                    {JSON.stringify(item.options, undefined, 2)}
                  </pre>
                </Expander>
              </>
            );
        }
      })()}
    </div>
  );
}
