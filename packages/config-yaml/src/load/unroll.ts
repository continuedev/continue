import * as YAML from "yaml";
import { Registry } from "../interfaces/index.js";
import {
  PackageSlug,
  decodeFullSlug,
  encodePackageSlug,
} from "../interfaces/slugs.js";
import { ConfigYaml, configYamlSchema } from "../schemas/index.js";
import { mergePackages } from "./merge.js";

export function parseConfigYaml(configYaml: string): ConfigYaml {
  try {
    const parsed = YAML.parse(configYaml);
    const result = configYamlSchema.parse(parsed);
    return result;
  } catch (e: any) {
    throw new Error(`Failed to parse config yaml: ${e.message}`);
  }
}

const TEMPLATE_VAR_REGEX = /\${{[\s]*([^}\s]+)[\s]*}}/g;

export function getTemplateVariables(templatedYaml: string): string[] {
  const variables = new Set<string>();
  const matches = templatedYaml.matchAll(TEMPLATE_VAR_REGEX);
  for (const match of matches) {
    variables.add(match[1]);
  }
  return Array.from(variables);
}

export function fillTemplateVariables(
  templatedYaml: string,
  data: { [key: string]: string },
): string {
  return templatedYaml.replace(TEMPLATE_VAR_REGEX, (match, variableName) => {
    // Inject data
    if (variableName in data) {
      return data[variableName];
    }
    // If variable doesn't exist, return the original expression
    return match;
  });
}

export async function unrollImportedPackage(
  pkgImport: NonNullable<ConfigYaml["packages"]>[number],
  parentPackages: PackageSlug[],
  registry: Registry,
): Promise<ConfigYaml> {
  const { uses, with: params } = pkgImport;

  const fullSlug = decodeFullSlug(uses);

  // Request the content from the registry
  const rawContent = await registry.getContent(fullSlug);

  // Convert the raw YAML to unrolled config
  return await unrollPackageFromContent(
    rawContent,
    params,
    parentPackages,
    registry,
  );
}

export interface TemplateData {
  params: Record<string, string> | undefined;
  secrets: Record<string, string> | undefined;
  continue: {};
}

function flattenTemplateData(
  templateData: TemplateData,
): Record<string, string> {
  const flattened: Record<string, string> = {};

  if (templateData.params) {
    for (const [key, value] of Object.entries(templateData.params)) {
      flattened[`params.${key}`] = value;
    }
  }
  if (templateData.secrets) {
    for (const [key, value] of Object.entries(templateData.secrets)) {
      flattened[`secrets.${key}`] = value;
    }
  }

  return flattened;
}

function secretToFQSNMap(
  secretNames: string[],
  parentPackages: PackageSlug[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const secret of secretNames) {
    const parentSlugs = parentPackages.map(encodePackageSlug);
    const parts = [...parentSlugs, secret];
    const fqsn = parts.join("/");
    map[secret] = `\${{ secrets.${fqsn} }}`;
  }

  return map;
}

function extractFQSNMap(
  rawContent: string,
  parentPackages: PackageSlug[],
): Record<string, string> {
  const templateVars = getTemplateVariables(rawContent);
  const secrets = templateVars
    .filter((v) => v.startsWith("secrets."))
    .map((v) => v.replace("secrets.", ""));

  return secretToFQSNMap(secrets, parentPackages);
}

export async function unrollPackageFromContent(
  rawContent: string,
  params: Record<string, string> | undefined,
  packagePath: PackageSlug[],
  registry: Registry,
): Promise<ConfigYaml> {
  // Collect template data
  const templateData: TemplateData = {
    // params are passed from the parent package
    params: params,
    // at this stage, secrets are mapped to a (still templated) FQSN
    secrets: extractFQSNMap(rawContent, packagePath),
    // Built-in variables
    continue: {},
  };

  const templatedYaml = fillTemplateVariables(
    rawContent,
    flattenTemplateData(templateData),
  );

  let parsedYaml = parseConfigYaml(templatedYaml);

  const unrolledChildPackages = await Promise.all(
    parsedYaml.packages?.map((pkg) => {
      const pkgSlug = decodeFullSlug(pkg.uses);
      return unrollImportedPackage(pkg, [...packagePath, pkgSlug], registry);
    }) ?? [],
  );

  delete parsedYaml.packages;
  for (const childPkg of unrolledChildPackages) {
    parsedYaml = mergePackages(parsedYaml, childPkg);
  }

  return parsedYaml;
}

/**
 * Loading an assistant is equivalent to loading a package without params
 */
export async function unrollAssistant(
  fullSlug: string,
  registry: Registry,
): Promise<ConfigYaml> {
  const packageSlug = decodeFullSlug(fullSlug);
  return await unrollImportedPackage(
    {
      uses: fullSlug,
    },
    [packageSlug],
    registry,
  );
}
