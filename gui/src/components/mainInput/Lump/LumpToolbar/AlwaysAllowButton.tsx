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
  | { kind: "idle" }
  | { kind: "working" }
  /** Waiting for a second yes: the tool's own safety check would still ask. */
  | { kind: "confirm"; rule: string }
  | { kind: "message"; text: string };

const COULD_NOT_SAVE = "Could not save the rule.";

/**
 * "Always allow": save a narrow allow rule for this call to config.yaml, then
 * run the call. The rule comes from core (`tools/suggestAllowRule`), which
 * refuses to build one it cannot make as narrow as the call. If it cannot
 * be saved, the call is NOT run: the user asked for a rule, not a one-off yes,
 * so they are told and can still press Accept.
 *
 * When the tool's own safety check would still ask about this call (a package
 * install, a network fetch, a script), the rule would switch that check off
 * for it. Then the exact rule is shown first and a second click saves it.
 */
export function AlwaysAllowButton({ toolCallId, toolName, parsedArgs }: Props) {
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useAppDispatch();
  const [state, setState] = useState<State>({ kind: "idle" });

  async function save(rule: string) {
    setState({ kind: "working" });
    try {
      const saved = await ideMessenger.request("config/addToolRule", {
        decision: "allow",
        rule,
      });
      if (saved.status !== "success") {
        return setState({ kind: "message", text: COULD_NOT_SAVE });
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
      setState({ kind: "message", text: COULD_NOT_SAVE });
    }
  }

  async function onClick() {
    if (state.kind === "confirm") return save(state.rule);

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
      if (suggestion.content.loosensCheck) {
        return setState({ kind: "confirm", rule: suggestion.content.rule });
      }
      await save(suggestion.content.rule);
    } catch {
      setState({ kind: "message", text: COULD_NOT_SAVE });
    }
  }

  return (
    <>
      {state.kind === "confirm" && (
        <span
          className="max-w-64 truncate font-mono text-2xs text-warning"
          title={`The safety check would still ask about this. Saves: ${state.rule}`}
          data-testid={`always-allow-confirm-${toolCallId}`}
        >
          {state.rule}
        </span>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="my-1 font-medium text-description-muted"
        disabled={state.kind === "working"}
        onClick={onClick}
        title={
          state.kind === "confirm"
            ? "This is normally checked before it runs. Click again to turn that check off for this exact call"
            : "Save a rule in config.yaml so this exact call runs without asking, then run it"
        }
        data-testid={`always-allow-button-${toolCallId}`}
      >
        <span>
          {state.kind === "confirm" ? "Confirm always allow" : "Always allow"}
        </span>
      </Button>
      {state.kind === "confirm" && (
        <Button
          variant="ghost"
          size="sm"
          className="my-1 font-medium text-description-muted"
          onClick={() => setState({ kind: "idle" })}
          data-testid={`always-allow-cancel-${toolCallId}`}
        >
          <span>Not now</span>
        </Button>
      )}
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
