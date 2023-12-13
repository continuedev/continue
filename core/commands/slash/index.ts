import GenerateTerminalCommand from "./cmd";
import CommentSlashCommand from "./comment";
import DraftIssueCommand from "./draftIssue";
import EditSlashCommand from "./edit";
import ShareSlashCommand from "./share";
import StackOverflowSlashCommand from "./stackOverflow";

export default [
  DraftIssueCommand,
  ShareSlashCommand,
  StackOverflowSlashCommand,
  GenerateTerminalCommand,
  EditSlashCommand,
  CommentSlashCommand,
];
