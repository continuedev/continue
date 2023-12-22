export interface ComboBoxItem {
  title: string;
  description: string;
  id?: string;
  content?: string;
}

export type DropdownState =
  | "contextProviders"
  | "closed"
  | "slashCommands"
  | "files";
