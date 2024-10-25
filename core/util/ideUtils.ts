import { IDE } from "..";

export async function resolveRelativePathInWorkspace(
  path: string,
  ide: IDE,
): Promise<string | undefined> {
  const pathSep = await ide.pathSep();
  if (path.startsWith(pathSep)) {
    return path;
  }

  const workspaces = await ide.getWorkspaceDirs();
  for (const workspace of workspaces) {
    const fullPath = `${workspace}${pathSep}${path}`;
    if (await ide.fileExists(fullPath)) {
      return fullPath;
    }
  }

  return undefined;
}
