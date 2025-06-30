import {
  prepareTemplatedFilepaths,
  registerHelpers,
  resolveHelperPromises,
  type HandlebarsType,
} from "./handlebarUtils";

export async function renderTemplatedString(
  handlebars: HandlebarsType,
  template: string,
  inputData: Record<string, string>,
  availableHelpers: Array<[string, Handlebars.HelperDelegate]>,
  readFile: (filepath: string) => Promise<string>,
  getUriFromPath: (path: string) => Promise<string | undefined>,
): Promise<string> {
  const helperPromises = availableHelpers
    ? registerHelpers(handlebars, availableHelpers)
    : {};

  const ctxProviderNames = availableHelpers?.map((h) => h[0]) ?? [];

  const { withLetterKeys, templateData } = await prepareTemplatedFilepaths(
    handlebars,
    template,
    inputData,
    ctxProviderNames,
    readFile,
    getUriFromPath,
  );

  const templateFn = handlebars.compile(withLetterKeys);
  const renderedString = templateFn(templateData);

  return resolveHelperPromises(renderedString, helperPromises);
}
