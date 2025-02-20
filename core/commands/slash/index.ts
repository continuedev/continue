import GenerateTerminalCommand from "./cmd";
import CommitMessageCommand from "./commit";
import DraftIssueCommand from "./draftIssue";
import OnboardSlashCommand from "./onboard";
import { RemoteServerSlashCommand, HttpSlashCommand } from "./remote";
import ReviewMessageCommand from "./review";
import ShareSlashCommand from "./share";

export default [
  DraftIssueCommand,
  ShareSlashCommand,
  GenerateTerminalCommand,
  HttpSlashCommand, // deprecated, use remote, left here for functionality
  RemoteServerSlashCommand,
  CommitMessageCommand,
  ReviewMessageCommand,
  OnboardSlashCommand,
];
