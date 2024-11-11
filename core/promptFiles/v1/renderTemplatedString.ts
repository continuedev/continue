import {
  compileAndRenderTemplate,
  prepareTemplateAndData,
  registerHelpers,
  resolveHelperPromises,
} from "./handlebarUtils";

export async function renderTemplatedString(
  template: string,
  readFile: (filepath: string) => Promise<string>,
  inputData: Record<string, string>,
  availableHelpers?: Array<[string, Handlebars.HelperDelegate]>,
): Promise<string> {
  const helperPromises = availableHelpers
    ? registerHelpers(availableHelpers)
    : {};

  const ctxProviderNames = availableHelpers?.map((h) => h[0]) ?? [];

  const [newTemplate, data] = await prepareTemplateAndData(
    template,
    readFile,
    inputData,
    ctxProviderNames,
  );

  let renderedString = compileAndRenderTemplate(newTemplate, data);

  return resolveHelperPromises(renderedString, helperPromises);
}
