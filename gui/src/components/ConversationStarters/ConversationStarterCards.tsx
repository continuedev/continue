import { SlashCommandDescription } from "core";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { setMainEditorContentTrigger } from "../../redux/slices/sessionSlice";
import { getParagraphNodeFromString } from "../mainInput/utils";
import { ConversationStarterCard } from "./ConversationStarterCard";
import { isDeprecatedCommandName } from "./utils";

export function ConversationStarterCards() {
  const dispatch = useAppDispatch();
  const slashCommands = useAppSelector(
    (state) => state.config.config.slashCommands,
  );

  const filteredSlashCommands = slashCommands?.filter(isDeprecatedCommandName);

  function onClick(command: SlashCommandDescription) {
    if (command.prompt) {
      dispatch(
        setMainEditorContentTrigger(getParagraphNodeFromString(command.prompt)),
      );
    }
  }

  return filteredSlashCommands?.map((command) => (
    <ConversationStarterCard command={command} onClick={onClick} />
  ));
}
