import GenerateTerminalCommand from "./cmd";
import CommentSlashCommand from "./comment";
import CommitMessageCommand from "./commit";
import DraftIssueCommand from "./draftIssue";
import EditSlashCommand from "./edit";
import HttpSlashCommand from "./http";
import ReviewMessageCommand from "./review";
import ShareSlashCommand from "./share";
import StackOverflowSlashCommand from "./stackOverflow";
import OnboardSlashCommand from "./onboard";

export default [
  DraftIssueCommand,
  ShareSlashCommand,
  StackOverflowSlashCommand,
  GenerateTerminalCommand,
  EditSlashCommand,
  CommentSlashCommand,
  HttpSlashCommand,
  CommitMessageCommand,
  ReviewMessageCommand,
  OnboardSlashCommand,
];
