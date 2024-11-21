import { PlatformPath, posix, win32 } from "node:path";
import { IDE } from "..";

export type PathSep = "/" | "\\";

function getPathModuleFromPathSep(pathSep: PathSep): PlatformPath {
  return pathSep === "/" ? posix : win32;
}

export async function getPathModuleForIde(ide: IDE): Promise<PlatformPath> {
  const pathSep = await ide.pathSep();
  return getPathModuleFromPathSep(pathSep as PathSep);
}
