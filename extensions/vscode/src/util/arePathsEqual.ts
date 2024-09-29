import * as os from "os";

export function arePathsEqual(path1: string, path2: string): boolean {
  if (os.platform() === "win32") {
    // On Windows, compare paths case-insensitively
    return path1.toLowerCase() === path2.toLowerCase();
  } else {
    // On other platforms, compare paths case-sensitively
    return path1 === path2;
  }
}
