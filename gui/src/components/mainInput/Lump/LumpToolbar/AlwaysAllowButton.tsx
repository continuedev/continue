import { useContext, useState } from "react";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { useAppDispatch } from "../../../../redux/hooks";
import { callToolById } from "../../../../redux/thunks/callToolById";
import { Button } from "../../../ui";

type Props = {
  toolCallId: string;
  toolName: string;
  parsedArgs: Record<string, unknown>;
};

type State =
  { kind: "idle" } | { kind: "working" } | { kind: "message"; text: string };

/**
 * "Always allow": save a narrow allow rule for this call to config.yaml, then
 * run the call. The rule comes from core (`tools/suggestAllowRule`), which
 * refuses to build one it cannot make as narrow as the call. If it cannot
 * be saved, the call is NOT run: the user asked for a rule, not a one-off yes,
 * so they are told and can still press Accept.
 */
export function AlwaysAllowButton({ toolCallId, toolName, parsedArgs }: Props) {
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useAppDispatch();
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onClick() {
    setState({ kind: "working" });
    try {
      const suggestion = await ideMessenger.request("tools/suggestAllowRule", {
        toolName,
        parsedArgs,
      });
      if (suggestion.status !== "success") {
        return setState({ kind: "message", text: "Could not make a rule." });
      }
      if (!suggestion.content.ok) {
        return setState({ kind: "message", text: suggestion.content.reason });
      }

      const saved = await ideMessenger.request("config/addToolRule", {
        decision: "allow",
        rule: suggestion.content.rule,
      });
      if (saved.status !== "success") {
        return setState({ kind: "message", text: "Could not save the rule." });
      }
      const result = saved.content.result;
      if (result === "no-config") {
        return setState({
          kind: "message",
          text: "Rules are saved in config.yaml, and this profile has none.",
        });
      }
      if (result === "invalid") {
        return setState({ kind: "message", text: "That rule is not valid." });
      }

      setState({ kind: "idle" });
      void dispatch(callToolById({ toolCallId }));
    } catch {
      setState({ kind: "message", text: "Could not save the rule." });
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="my-1 font-medium text-description-muted"
        disabled={state.kind === "working"}
        onClick={onClick}
        title="Save a rule in config.yaml so this exact call runs without asking, then run it"
        data-testid={`always-allow-button-${toolCallId}`}
      >
        <span>Always allow</span>
      </Button>
      {state.kind === "message" && (
        <span
          role="alert"
          className="max-w-48 truncate text-2xs text-description"
          title={state.text}
          data-testid={`always-allow-message-${toolCallId}`}
        >
          {state.text}
        </span>
      )}
    </>
  );
}
