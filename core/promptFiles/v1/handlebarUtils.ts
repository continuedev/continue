import Handlebars from "handlebars";
import { v4 as uuidv4 } from "uuid";

function convertToLetter(num: number): string {
  let result = "";
  while (num > 0) {
    const remainder = (num - 1) % 26;
    result = String.fromCharCode(97 + remainder) + result;
    num = Math.floor((num - 1) / 26);
  }
  return result;
}

/**
 *  We replace filepaths with alphabetic characters to handle
 *  escaping issues.
 */
const replaceFilepaths = (
  value: string,
  ctxProviderNames: string[],
): [string, { [key: string]: string }] => {
  const ast = Handlebars.parse(value);

  const keysToFilepath: { [key: string]: string } = {};

  let keyIndex = 1;

  for (const i in ast.body) {
    const node = ast.body[i] as any;

    if (node.type === "MustacheStatement") {
      const originalNodeVal = node.path.original;
      const isFilepath = !ctxProviderNames.includes(originalNodeVal);

      if (isFilepath) {
        const letter = convertToLetter(keyIndex);

        keysToFilepath[letter] = originalNodeVal;

        value = value.replace(
          new RegExp(`{{\\s*${originalNodeVal}\\s*}}`),
          `{{${letter}}}`,
        );

        keyIndex++;
      }
    }
  }

  return [value, keysToFilepath];
};

export function registerHelpers(
  helpers: Array<[string, Handlebars.HelperDelegate]>,
): {
  [key: string]: Promise<string>;
} {
  const promises: { [key: string]: Promise<string> } = {};

  for (const [name, helper] of helpers) {
    Handlebars.registerHelper(name, (...args) => {
      const id = uuidv4();
      promises[id] = helper(...args);
      return `__${id}__`;
    });
  }

  return promises;
}

export async function prepareTemplateAndData(
  template: string,
  readFile: (filepath: string) => Promise<string>,
  inputData: Record<string, string>,
  ctxProviderNames: string[],
): Promise<[string, any]> {
  const [newTemplate, vars] = replaceFilepaths(template, ctxProviderNames);

  const data: any = { ...inputData };

  for (const [replacedName, originalCtxProviderName] of Object.entries(vars)) {
    data[replacedName] =
      inputData[originalCtxProviderName] ?? originalCtxProviderName;

    // If it's not a context provider, assume it's a filepath.
    if (!ctxProviderNames.includes(originalCtxProviderName)) {
      const fileContents = await readFile(vars[replacedName]);

      if (fileContents) {
        data[replacedName] = fileContents;
      }
    }
  }

  return [newTemplate, data];
}

export function compileAndRenderTemplate(
  template: string,
  data: Record<string, string>,
): string {
  const templateFn = Handlebars.compile(template);
  return templateFn(data);
}

export async function resolveHelperPromises(
  renderedString: string,
  promises: { [key: string]: Promise<string> },
): Promise<string> {
  await Promise.all(Object.values(promises));

  for (const id in promises) {
    renderedString = renderedString.replace(`__${id}__`, await promises[id]);
  }

  return renderedString;
}
