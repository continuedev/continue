import { ContextItem } from "core";
import { resolveRelativePathInDir } from "core/util/ideUtils";
import { ClientToolImpl } from "./callClientTool";

import { findUriInDirs, getUriFileExtension } from "core/util/uri";
import { IIdeMessenger } from "../../context/IdeMessenger";

export const editToolImpl: ClientToolImpl = async (
  args,
  toolCallId,
  extras,
) => {
  if (!extras.streamId) {
    throw new Error("Invalid apply state");
  }
  const firstUriMatch = await resolveRelativePathInDir(
    args.filepath,
    extras.ideMessenger.ide,
  );
  if (!firstUriMatch) {
    throw new Error(`${args.filepath} does not exist`);
  }
  const apply = await extras.ideMessenger.request("applyToFile", {
    streamId: extras.streamId,
    text: args.changes,
    toolCallId,
    filepath: firstUriMatch,
  });
  if (apply.status === "error") {
    throw new Error(apply.error);
  }
  const state = extras.getState();
  const autoAccept = !!state.config.config.ui?.autoAcceptEditToolDiffs;
  if (autoAccept) {
    const out = await extras.ideMessenger.request("acceptDiff", {
      streamId: extras.streamId,
      filepath: firstUriMatch,
    });
    if (out.status === "error") {
      throw new Error(out.error);
    }
    const output = await getEditToolOutput(firstUriMatch, extras.ideMessenger);
    return {
      respondImmediately: true,
      output,
    };
  }
  return {
    respondImmediately: false,
    output: undefined, // No immediate output.
  };
};

export const getEditToolOutput = async (
  filepath: string | undefined,
  ideMessenger: IIdeMessenger,
): Promise<ContextItem[]> => {
  let content = "The contents of the file after editing are:\n\n";
  if (filepath) {
    const response = await ideMessenger.request("readFile", {
      filepath,
    });
    const dirsResponse = await ideMessenger.request(
      "getWorkspaceDirs",
      undefined,
    );
    const workspaceDirs =
      dirsResponse.status === "error"
        ? (window.workspacePaths ?? [])
        : dirsResponse.content;
    const { relativePathOrBasename } = findUriInDirs(filepath, workspaceDirs);

    if (response.status === "success") {
      content += `\`\`\`${getUriFileExtension(filepath)} ${relativePathOrBasename}
      ${response.content}
\`\`\``;
    } else {
      content += `Error reading file`;
    }
  }

  const output: ContextItem = {
    name: "Edit Results New File Contents",
    content,
    description: "File contents after edit",
  };
  return [output];
};
