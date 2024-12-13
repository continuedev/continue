import generateRepoMap from "../../util/generateRepoMap";
import { resolveRelativePathInDir } from "../../util/ideUtils";

import { ToolImpl } from ".";

export const viewSubdirectoryImpl: ToolImpl = async (args: any, extras) => {
  const { directory_path } = args;
  const absoluteUri = await resolveRelativePathInDir(
    directory_path,
    extras.ide,
  );

  if (!absoluteUri) {
    throw new Error(`Directory path "${directory_path}" does not exist.`);
  }

  const repoMap = await generateRepoMap(extras.llm, extras.ide, {
    dirs: [absoluteUri],
  });
  return [
    {
      name: "Repo map",
      description: `Map of ${directory_path}`,
      content: repoMap,
    },
  ];
};
