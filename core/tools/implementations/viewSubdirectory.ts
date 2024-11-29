import generateRepoMap from "../../util/generateRepoMap";
import { resolveRelativePathInWorkspace } from "../../util/ideUtils";

import { ToolImpl } from ".";

export const viewSubdirectoryImpl: ToolImpl = async (args: any, extras) => {
  const { directory_path } = args;
  const absolutePath = await resolveRelativePathInWorkspace(
    directory_path,
    extras.ide,
  );

  if (!absolutePath) {
    throw new Error(`Directory path "${directory_path}" does not exist.`);
  }

  const repoMap = await generateRepoMap(extras.llm, extras.ide, {
    dirs: [absolutePath],
  });
  return [
    {
      name: "Repo map",
      description: `Map of ${directory_path}`,
      content: repoMap,
    },
  ];
};
