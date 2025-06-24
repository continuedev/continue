import {
  prepareTemplatedFilepaths,
  registerHelpers,
  resolveHelperPromises,
} from "./handlebarUtils";

export async function renderTemplatedString(
  template: string,
  inputData: Record<string, string>,
  availableHelpers: Array<[string, Handlebars.HelperDelegate]>,
  readFile: (filepath: string) => Promise<string>,
  getUriFromPath: (path: string) => Promise<string | undefined>,
): Promise<string> {
  const helperPromises = availableHelpers
    ? registerHelpers(availableHelpers)
    : {};

  const ctxProviderNames = availableHelpers?.map((h) => h[0]) ?? [];

  const { withLetterKeys, templateData } = await prepareTemplatedFilepaths(
    template,
    inputData,
    ctxProviderNames,
    readFile,
    getUriFromPath,
  );

  const templateFn = Handlebars.compile(withLetterKeys);
  const renderedString = templateFn(templateData);

  return resolveHelperPromises(renderedString, helperPromises);
}
