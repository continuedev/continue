import { SUBAGENT_TOOL_META } from "../subagent/index.js";

import { askQuestionTool } from "./askQuestion.js";
import { configTool } from "./configTool.js";
import {
  coreFileGlobSearchTool,
  coreGithubTool,
  coreLsTool,
  coreReadFileTool,
  coreSearchWebTool,
  coreSendMessageTool,
  coreSleepTool,
  coreTaskCreateTool,
  coreTaskGetTool,
  coreTaskListTool,
  coreTaskOutputTool,
  coreTaskStopTool,
  coreTaskUpdateTool,
  coreTodoWriteTool,
  coreViewDiffTool,
} from "./coreToolBridge.js";
import { editTool } from "./edit.js";
import { exitTool } from "./exit.js";
import { fetchTool } from "./fetch.js";
import { gitTool } from "./git.js";
import { grepTool } from "./grep.js";
import { listMcpResourcesTool } from "./listMcpResources.js";
import { mcpAuthTool } from "./mcpAuth.js";
import { multiEditTool } from "./multiEdit.js";
import { readMcpResourceTool } from "./readMcpResource.js";
import { reportFailureTool } from "./reportFailure.js";
import { runTerminalCommandTool } from "./runTerminalCommand.js";
import { searchCodeTool } from "./searchCode.js";
import { SKILLS_TOOL_META } from "./skills.js";
import { statusTool } from "./status.js";
import { teamCreateTool } from "./teamCreate.js";
import { teamDeleteTool } from "./teamDelete.js";
import { teamStatusTool } from "./teamStatus.js";
import { toolSearchTool } from "./toolSearch.js";
import { uploadArtifactTool } from "./uploadArtifact.js";
import { writeChecklistTool } from "./writeChecklist.js";
import { writeFileTool } from "./writeFile.js";

// putting in here for circular import issue
export const ALL_BUILT_IN_TOOLS = [
  // ── Core-backed tools (delegate to core/tools via CliIde) ──────────────────
  coreFileGlobSearchTool,
  coreGithubTool,
  coreLsTool,
  coreReadFileTool,
  coreSearchWebTool,
  coreSendMessageTool,
  coreSleepTool,
  coreTaskCreateTool,
  coreTaskGetTool,
  coreTaskListTool,
  coreTaskOutputTool,
  coreTaskStopTool,
  coreTaskUpdateTool,
  coreTodoWriteTool,
  coreViewDiffTool,

  // ── CLI-specific tools ──────────────────────────────────────────────────────
  askQuestionTool,
  configTool,
  editTool,
  exitTool,
  fetchTool,
  gitTool,
  grepTool,
  listMcpResourcesTool,
  mcpAuthTool,
  multiEditTool,
  readMcpResourceTool,
  reportFailureTool,
  runTerminalCommandTool,
  searchCodeTool,
  statusTool,
  SUBAGENT_TOOL_META,
  SKILLS_TOOL_META,
  teamCreateTool,
  teamDeleteTool,
  teamStatusTool,
  toolSearchTool,
  uploadArtifactTool,
  writeChecklistTool,
  writeFileTool,
];
