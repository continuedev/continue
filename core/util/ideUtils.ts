import { IDE } from "..";
import { pathToUriPathSegment } from "./uri";

/*
  This function takes a relative filepath
  And checks each workspace for if it exists or not
  Only returns fully resolved URI if it exists
*/
export async function resolveRelativePathInWorkspace(
  path: string,
  ide: IDE,
): Promise<string | undefined> {
  const cleanPath = pathToUriPathSegment(path);
  const workspaces = await ide.getWorkspaceDirs();
  for (const workspace of workspaces) {
    const fullUri = `${workspace}/${cleanPath}`;
    if (await ide.fileExists(fullUri)) {
      return fullUri;
    }
  }

  return undefined;
}

/*
  This function takes a relative filepath (which may not exist)
  And, based on which workspace has the closest matching path
  Guesses which workspace and returns resolved URI

  Original use case of for tools trying to create new files
  If no meaninful path match just concatenates to first workspace's uri
*/
export async function inferResolvedUriFromRelativePath(
  path: string,
  ide: IDE,
): Promise<string> {
  const cleanPath = pathToUriPathSegment(path);

  const 
  const workspaces = await ide.getWorkspaceDirs();
  for (const workspace of workspaces) {
    const fullUri = `${workspace}/${cleanPath}`;
    if (await ide.fileExists(fullUri)) {
      return fullUri;
    }
  }
  // console.warn("No meaninful filepath inferred from relative path " + path)
  return `${workspaces[0]}/${cleanPath}`
}