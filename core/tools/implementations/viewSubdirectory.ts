import generateRepoMap from "../../util/generateRepoMap";

import { ToolImpl } from ".";

export const viewSubdirectoryImpl: ToolImpl = async (args: any, extras) => {
  const { directory_path } = args;
  const repoMap = await generateRepoMap(extras.llm, extras.ide, {
    dirs: [directory_path],
  });
  return [
    {
      name: "Repo map",
      description: `Map of ${directory_path}`,
      content: repoMap,
    },
  ];
};
