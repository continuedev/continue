import generateRepoMap from "../../util/generateRepoMap";
import { resolveRelativePathInDir } from "../../util/ideUtils";

import { ToolImpl } from ".";
import { ContinueError, ContinueErrorReason } from "../../util/errors";
import { getStringArg } from "../parseArgs";

export const viewSubdirectoryImpl: ToolImpl = async (args: any, extras) => {
  const directory_path = getStringArg(args, "directory_path");

  const uri = await resolveRelativePathInDir(directory_path, extras.ide);

  if (!uri) {
    throw new ContinueError(
      ContinueErrorReason.DirectoryNotFound,
      `Directory path "${directory_path}" does not exist.`,
    );
  }

  const repoMap = await generateRepoMap(extras.llm, extras.ide, {
    dirUris: [uri],
    outputRelativeUriPaths: true,
    includeSignatures: false,
  });

  return [
    {
      name: "Repo map",
      description: `Map of ${directory_path}`,
      content: repoMap,
    },
  ];
};
