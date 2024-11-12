import GenerateTerminalCommand from "./cmd";
import CommitMessageCommand from "./commit";
import DraftIssueCommand from "./draftIssue";
import HttpSlashCommand from "./http";
import MultiFileEditSlashCommand from "./multifileEdit";
import OnboardSlashCommand from "./onboard";
import ReviewMessageCommand from "./review";
import ShareSlashCommand from "./share";

export default [
  DraftIssueCommand,
  ShareSlashCommand,
  GenerateTerminalCommand,
  HttpSlashCommand,
  CommitMessageCommand,
  ReviewMessageCommand,
  OnboardSlashCommand,
  MultiFileEditSlashCommand,
];
