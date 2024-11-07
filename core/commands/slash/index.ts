import GenerateTerminalCommand from "./cmd";
import CommentSlashCommand from "./comment";
import CommitMessageCommand from "./commit";
import DraftIssueCommand from "./draftIssue";
import EditSlashCommand from "./edit";
import HttpSlashCommand from "./http";
import MultiFileEditSlashCommand from "./multifileEdit";
import OnboardSlashCommand from "./onboard";
import ReviewMessageCommand from "./review";
import ShareSlashCommand from "./share";

export default [
  DraftIssueCommand,
  ShareSlashCommand,
  GenerateTerminalCommand,
  EditSlashCommand,
  CommentSlashCommand,
  HttpSlashCommand,
  CommitMessageCommand,
  ReviewMessageCommand,
  OnboardSlashCommand,
  MultiFileEditSlashCommand,
];
