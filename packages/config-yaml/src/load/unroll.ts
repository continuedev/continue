import * as YAML from "yaml";
import { PlatformClient, Registry } from "../interfaces/index.js";
import { encodeSecretLocation } from "../interfaces/SecretResult.js";
import {
  decodeFQSN,
  decodeFullSlug,
  encodeFQSN,
  encodePackageSlug,
  FQSN,
  FullSlug,
  PackageSlug,
} from "../interfaces/slugs.js";
import {
  AssistantUnrolled,
  assistantUnrolledSchema,
  Block,
  blockSchema,
  ConfigYaml,
  configYamlSchema,
  Rule,
} from "../schemas/index.js";
import { useProxyForUnrenderedSecrets } from "./clientRender.js";

export function parseConfigYaml(configYaml: string): ConfigYaml {
  try {
    const parsed = YAML.parse(configYaml);
    const result = configYamlSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    throw new Error(
      result.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(""),
    );
  } catch (e) {
    console.log("Failed to parse rolled assistant:", configYaml);
    throw new Error(
      `Failed to parse assistant:\n${e instanceof Error ? e.message : e}`,
    );
  }
}

export function parseAssistantUnrolled(configYaml: string): AssistantUnrolled {
  try {
    const parsed = YAML.parse(configYaml);
    const result = assistantUnrolledSchema.parse(parsed);
    return result;
  } catch (e: any) {
    throw new Error(
      `Failed to parse unrolled assistant: ${e.message}\n\n${configYaml}`,
    );
  }
}

export function parseBlock(configYaml: string): Block {
  try {
    const parsed = YAML.parse(configYaml);
    const result = blockSchema.parse(parsed);
    return result;
  } catch (e: any) {
    throw new Error(`Failed to parse block: ${e.message}`);
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

export interface TemplateData {
  inputs: Record<string, string> | undefined;
  secrets: Record<string, string> | undefined;
  continue: {};
}

function flattenTemplateData(
  templateData: TemplateData,
): Record<string, string> {
  const flattened: Record<string, string> = {};

  if (templateData.inputs) {
    for (const [key, value] of Object.entries(templateData.inputs)) {
      flattened[`inputs.${key}`] = value;
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

/**
 * All template vars are already FQSNs, here we just resolve them to either locations or values
 */
async function extractRenderedSecretsMap(
  rawContent: string,
  platformClient: PlatformClient,
): Promise<Record<string, string>> {
  // Get all template variables
  const templateVars = getTemplateVariables(rawContent);
  const secrets = templateVars
    .filter((v) => v.startsWith("secrets."))
    .map((v) => v.replace("secrets.", ""));

  const fqsns: FQSN[] = secrets.map(decodeFQSN);

  // FQSN -> SecretResult
  const secretResults = await platformClient.resolveFQSNs(fqsns);

  const map: Record<string, string> = {};
  for (const secretResult of secretResults) {
    if (!secretResult) {
      continue;
    }

    // User secrets are rendered
    if ("value" in secretResult) {
      map[encodeFQSN(secretResult.fqsn)] = secretResult.value;
    } else {
      // Other secrets are rendered as secret locations and then converted to proxy types later
      map[encodeFQSN(secretResult.fqsn)] =
        `\${{ secrets.${encodeSecretLocation(secretResult.secretLocation)} }}`;
    }
  }

  return map;
}

export interface DoNotRenderSecretsUnrollAssistantOptions {
  renderSecrets: false;
}

export interface RenderSecretsUnrollAssistantOptions {
  renderSecrets: true;
  orgScopeId: string | null;
  currentUserSlug: string;
  platformClient: PlatformClient;
  onPremProxyUrl: string | null;
}

export type UnrollAssistantOptions =
  | DoNotRenderSecretsUnrollAssistantOptions
  | RenderSecretsUnrollAssistantOptions;

export async function unrollAssistant(
  fullSlug: string,
  registry: Registry,
  options: UnrollAssistantOptions,
): Promise<AssistantUnrolled> {
  const assistantSlug = decodeFullSlug(fullSlug);

  // Request the content from the registry
  const rawContent = await registry.getContent(assistantSlug);
  return unrollAssistantFromContent(
    assistantSlug,
    rawContent,
    registry,
    options,
  );
}

function renderTemplateData(
  rawYaml: string,
  templateData: Partial<TemplateData>,
): string {
  const fullTemplateData: TemplateData = {
    inputs: {},
    secrets: {},
    continue: {},
    ...templateData,
  };
  const templatedYaml = fillTemplateVariables(
    rawYaml,
    flattenTemplateData(fullTemplateData),
  );
  return templatedYaml;
}

export async function unrollAssistantFromContent(
  assistantSlug: FullSlug,
  rawYaml: string,
  registry: Registry,
  options: UnrollAssistantOptions,
): Promise<AssistantUnrolled> {
  // Parse string to Zod-validated YAML
  let parsedYaml = parseConfigYaml(rawYaml);

  // Unroll blocks and convert their secrets to FQSNs
  const unrolledAssistant = await unrollBlocks(parsedYaml, registry);

  // Back to a string so we can fill in template variables
  const rawUnrolledYaml = YAML.stringify(unrolledAssistant);

  // Convert all of the template variables to FQSNs
  // Secrets from the block will have the assistant slug prepended to the FQSN
  const templatedYaml = renderTemplateData(rawUnrolledYaml, {
    secrets: extractFQSNMap(rawUnrolledYaml, [assistantSlug]),
  });

  if (!options.renderSecrets) {
    return parseAssistantUnrolled(templatedYaml);
  }

  // Render secret values/locations for client
  const secrets = await extractRenderedSecretsMap(
    templatedYaml,
    options.platformClient,
  );
  const renderedYaml = renderTemplateData(templatedYaml, {
    secrets,
  });

  // Parse again and replace models with proxy versions where secrets weren't rendered
  const finalConfig = useProxyForUnrenderedSecrets(
    parseAssistantUnrolled(renderedYaml),
    assistantSlug,
    options.orgScopeId,
    options.onPremProxyUrl,
  );
  return finalConfig;
}

export async function unrollBlocks(
  assistant: ConfigYaml,
  registry: Registry,
): Promise<AssistantUnrolled> {
  const unrolledAssistant: AssistantUnrolled = {
    name: assistant.name,
    version: assistant.version,
  };

  const sections: (keyof Omit<
    ConfigYaml,
    "name" | "version" | "rules" | "schema"
  >)[] = ["models", "context", "data", "mcpServers", "prompts", "docs"];

  // For each section, replace "uses/with" blocks with the real thing
  for (const section of sections) {
    if (assistant[section]) {
      const sectionBlocks: any[] = [];

      for (const unrolledBlock of assistant[section]) {
        // "uses/with" block
        if ("uses" in unrolledBlock) {
          const blockConfigYaml = await resolveBlock(
            decodeFullSlug(unrolledBlock.uses),
            unrolledBlock.with,
            registry,
          );
          const block = blockConfigYaml[section]?.[0];
          if (block) {
            sectionBlocks.push(
              mergeOverrides(block, unrolledBlock.override ?? {}),
            );
          }
        } else {
          // Normal block
          sectionBlocks.push(unrolledBlock);
        }
      }

      unrolledAssistant[section] = sectionBlocks;
    }
  }

  // Rules are a bit different because they can be strings, so hanlde separately
  if (assistant.rules) {
    const rules: Rule[] = [];
    for (const rule of assistant.rules) {
      if (typeof rule === "string" || !("uses" in rule)) {
        rules.push(rule);
      } else if ("uses" in rule) {
        const blockConfigYaml = await resolveBlock(
          decodeFullSlug(rule.uses),
          rule.with,
          registry,
        );
        const block = blockConfigYaml.rules?.[0];
        if (block) {
          rules.push(block);
        }
      }
    }

    unrolledAssistant.rules = rules;
  }

  return unrolledAssistant;
}

export async function resolveBlock(
  fullSlug: FullSlug,
  inputs: Record<string, string> | undefined,
  registry: Registry,
): Promise<AssistantUnrolled> {
  // Retrieve block raw yaml
  const rawYaml = await registry.getContent(fullSlug);

  if (rawYaml === undefined) {
    throw new Error(
      `Block ${fullSlug.ownerSlug}/${fullSlug.packageSlug} not found`,
    );
  }

  // Convert any input secrets to FQSNs (they get FQSNs as if they are in the block. This is so that we know when to use models add-on / free trial secrets)
  const renderedInputs = inputsToFQSNs(inputs || {}, fullSlug);

  // Render template variables
  const templatedYaml = renderTemplateData(rawYaml, {
    inputs: renderedInputs,
    secrets: extractFQSNMap(rawYaml, [fullSlug]),
  });

  const parsedYaml = parseBlock(templatedYaml);
  return parsedYaml;
}

function inputsToFQSNs(
  inputs: Record<string, string>,
  blockSlug: PackageSlug,
): Record<string, string> {
  const renderedInputs: Record<string, string> = {};
  for (const [key, value] of Object.entries(inputs)) {
    renderedInputs[key] = renderTemplateData(value, {
      secrets: extractFQSNMap(value, [blockSlug]),
    });
  }
  return renderedInputs;
}

export function mergeOverrides<T extends Record<string, any>>(
  block: T,
  overrides: Partial<T>,
): T {
  for (const key in overrides) {
    if (overrides.hasOwnProperty(key)) {
      block[key] = overrides[key]!;
    }
  }
  return block;
}
