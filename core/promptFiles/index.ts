import { IDE } from "..";
import { getPromptFiles } from "./getPromptFiles";
import { createNewPromptFile } from "./createNewPromptFile";
import { slashCommandFromPromptFile } from "./slashCommandFromPromptFile";

export const DEFAULT_PROMPTS_FOLDER = ".prompts";

export { getPromptFiles, createNewPromptFile, slashCommandFromPromptFile };
