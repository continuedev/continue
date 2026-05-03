import { resolveRelativePathInDir } from "core/util/ideUtils";
import { ContextItem } from "core";
import { ClientToolImpl } from "./callClientTool";

function buildOutput(content: string): ContextItem[] {
  return [
    {
      name: "Notebook updated",
      description: "Notebook cell edit applied",
      content,
    },
  ];
}

export const notebookEditToolImpl: ClientToolImpl = async (
  args,
  _toolCallId,
  extras,
) => {
  const { filepath, cellIndex, editMode, newSource, cellType } = args ?? {};
  if (!filepath || typeof cellIndex !== "number" || !editMode) {
    throw new Error(
      "`filepath`, `cellIndex`, and `editMode` are required to edit a notebook.",
    );
  }
  if (editMode !== "delete" && typeof newSource !== "string") {
    throw new Error("`newSource` is required for notebook insert and replace operations.");
  }

  const ideInfo = await extras.ideMessenger.ide.getIdeInfo();
  if (ideInfo.ideType !== "vscode") {
    throw new Error("Notebook editing is currently supported only in VS Code.");
  }

  let resolved = await resolveRelativePathInDir(filepath, extras.ideMessenger.ide);
  if (!resolved) {
    const openFiles = await extras.ideMessenger.ide.getOpenFiles();
    resolved = openFiles.find((uri) => uri.endsWith(filepath));
  }
  if (!resolved) {
    throw new Error(`${filepath} does not exist`);
  }

  const result = await extras.ideMessenger.request("notebook/edit", {
    filepath: resolved,
    cellIndex,
    editMode,
    newSource,
    cellType,
  });
  if (result.status === "error") {
    throw new Error(result.error);
  }

  const operationText =
    editMode === "delete"
      ? `Deleted cell ${cellIndex}`
      : editMode === "insert"
        ? `Inserted ${cellType ?? "code"} cell at index ${cellIndex}`
        : `Updated cell ${cellIndex}`;

  return {
    respondImmediately: true,
    output: buildOutput(`${operationText} in ${filepath}.`),
  };
};