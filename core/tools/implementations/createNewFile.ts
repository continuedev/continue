import { getPathModuleForIde } from "../../util/pathModule";

import { ToolImpl } from ".";

export const createNewFileImpl: ToolImpl = async (args, extras) => {
  const pathSep = await extras.ide.pathSep();
  let filepath = args.filepath;
  if (!args.filepath.startsWith(pathSep)) {
    const pathModule = await getPathModuleForIde(extras.ide);
    const workspaceDirs = await extras.ide.getWorkspaceDirs();
    const cwd = workspaceDirs[0];
    filepath = pathModule.join(cwd, filepath);
  }
  await extras.ide.writeFile(filepath, args.contents);
  await extras.ide.openFile(filepath);
  return [];
};
