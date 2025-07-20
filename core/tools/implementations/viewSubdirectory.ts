import generateRepoMap from "../../util/generateRepoMap";
import { resolveRelativePathInDir } from "../../util/ideUtils";

import { ToolImpl } from ".";

export const viewSubdirectoryImpl: ToolImpl = async (args: any, extras) => {
  if (!args?.directory_path) {
    throw new Error(
      "`directory_path` argument is required to view a map of a subdirectory, and cannot be empty",
    );
  }
  const { directory_path } = args;

  const uri = await resolveRelativePathInDir(directory_path, extras.ide);

  if (!uri) {
    throw new Error(`Directory path "${directory_path}" does not exist.`);
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
