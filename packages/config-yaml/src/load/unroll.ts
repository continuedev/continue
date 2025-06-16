import * as YAML from "yaml";
import { ZodError } from "zod";
import { PlatformClient, Registry } from "../interfaces/index.js";
import { encodeSecretLocation } from "../interfaces/SecretResult.js";
import {
  decodeFQSN,
  decodePackageIdentifier,
  encodeFQSN,
  FQSN,
  PackageIdentifier,
} from "../interfaces/slugs.js";
import { markdownToRule } from "../markdown/index.js";
import {
  AssistantUnrolled,
  assistantUnrolledSchema,
  Block,
  blockSchema,
  ConfigYaml,
  configYamlSchema,
  Rule,
} from "../schemas/index.js";
import { ConfigResult, ConfigValidationError } from "../validation.js";
import {
  packageIdentifierToShorthandSlug,
  useProxyForUnrenderedSecrets,
} from "./clientRender.js";
import { getBlockType } from "./getBlockType.js";

export function parseConfigYaml(configYaml: string): ConfigYaml {
  try {
    const parsed = YAML.parse(configYaml);
    const result = configYamlSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }

    throw new Error(formatZodError(result.error), {
      cause: "result.success was false",
    });
  } catch (e) {
    console.error("Failed to parse rolled assistant:", configYaml);
    if (
      e instanceof Error &&
      "cause" in e &&
      e.cause === "result.success was false"
    ) {
      throw new Error(`Failed to parse assistant: ${e.message}`);
    } else if (e instanceof ZodError) {
      throw new Error(`Failed to parse assistant: ${formatZodError(e)}`);
    } else {
      throw new Error(
        `Failed to parse assistant: ${e instanceof Error ? e.message : e}`,
      );
    }
  }
}

export function parseAssistantUnrolled(configYaml: string): AssistantUnrolled {
  try {
    const parsed = YAML.parse(configYaml);
    const result = assistantUnrolledSchema.parse(parsed);
    return result;
  } catch (e: any) {
    console.error(
      `Failed to parse unrolled assistant: ${e.message}\n\n${configYaml}`,
    );
    throw new Error(`Failed to parse unrolled assistant: ${formatZodError(e)}`);
  }
}

export function parseBlock(configYaml: string): Block {
  try {
    const parsed = YAML.parse(configYaml);
    const result = blockSchema.parse(parsed);
    return result;
  } catch (e: any) {
    throw new Error(`Failed to parse block: ${formatZodError(e)}`);
  }
}

export const TEMPLATE_VAR_REGEX = /\${{[\s]*([^}\s]+)[\s]*}}/g;

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
  parentPackages: PackageIdentifier[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const secret of secretNames) {
    const parentSlugs = parentPackages.map(packageIdentifierToShorthandSlug);
    const parts = [...parentSlugs, secret];
    const fqsn = parts.join("/");
    map[secret] = `\${{ secrets.${fqsn} }}`;
  }

  return map;
}

function extractFQSNMap(
  rawContent: string,
  parentPackages: PackageIdentifier[],
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
  alwaysUseProxy: boolean = false,
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
    if ("value" in secretResult && !alwaysUseProxy) {
      map[encodeFQSN(secretResult.fqsn)] = secretResult.value;
    } else {
      // Other secrets are rendered as secret locations and then converted to proxy types later
      map[encodeFQSN(secretResult.fqsn)] =
        `\${{ secrets.${encodeSecretLocation(secretResult.secretLocation)} }}`;
    }
  }

  return map;
}

export interface BaseUnrollAssistantOptions {
  renderSecrets: boolean;
  injectBlocks?: PackageIdentifier[];
  asConfigResult?: boolean; // TODO: Decide
}

export interface DoNotRenderSecretsUnrollAssistantOptions
  extends BaseUnrollAssistantOptions {
  renderSecrets: false;
}

export interface RenderSecretsUnrollAssistantOptions
  extends BaseUnrollAssistantOptions {
  renderSecrets: true;
  orgScopeId: string | null;
  currentUserSlug: string;
  platformClient: PlatformClient;
  onPremProxyUrl: string | null;
  alwaysUseProxy?: boolean;
}

export type UnrollAssistantOptions =
  | DoNotRenderSecretsUnrollAssistantOptions
  | RenderSecretsUnrollAssistantOptions;

// Overload to satisfy existing consumers of unrollAssistant.
export async function unrollAssistant(
  id: PackageIdentifier,
  registry: Registry,
  options: UnrollAssistantOptions & { asConfigResult: true },
): Promise<ConfigResult<AssistantUnrolled>>;

export async function unrollAssistant(
  id: PackageIdentifier,
  registry: Registry,
  options: UnrollAssistantOptions,
): Promise<AssistantUnrolled>;

export async function unrollAssistant(
  id: PackageIdentifier,
  registry: Registry,
  options: UnrollAssistantOptions,
): Promise<AssistantUnrolled | ConfigResult<AssistantUnrolled>> {
  // Request the content from the registry
  const rawContent = await registry.getContent(id);

  const result = unrollAssistantFromContent(id, rawContent, registry, options);

  return result;
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
  id: PackageIdentifier,
  rawYaml: string,
  registry: Registry,
  options: UnrollAssistantOptions,
): Promise<AssistantUnrolled | ConfigResult<AssistantUnrolled>> {
  // Parse string to Zod-validated YAML
  let parsedYaml = parseConfigYaml(rawYaml);

  // Unroll blocks and convert their secrets to FQSNs
  const unrolledAssistant = await unrollBlocks(
    parsedYaml,
    registry,
    options.injectBlocks,
    options.asConfigResult ?? false,
  );

  // Back to a string so we can fill in template variables
  const rawUnrolledYaml = options.asConfigResult
    ? YAML.stringify(
        (unrolledAssistant as ConfigResult<AssistantUnrolled>).config,
      )
    : YAML.stringify(unrolledAssistant);

  // Convert all of the template variables to FQSNs
  // Secrets from the block will have the assistant slug prepended to the FQSN
  const templatedYaml = renderTemplateData(rawUnrolledYaml, {
    secrets: extractFQSNMap(rawUnrolledYaml, [id]),
  });

  if (!options.renderSecrets) {
    return parseAssistantUnrolled(templatedYaml);
  }

  // Render secret values/locations for client
  const secrets = await extractRenderedSecretsMap(
    templatedYaml,
    options.platformClient,
    options.alwaysUseProxy,
  );
  const renderedYaml = renderTemplateData(templatedYaml, {
    secrets,
  });

  // Parse again and replace models with proxy versions where secrets weren't rendered
  const finalConfig = useProxyForUnrenderedSecrets(
    parseAssistantUnrolled(renderedYaml),
    id,
    options.orgScopeId,
    options.onPremProxyUrl,
  );

  if (options.asConfigResult) {
    return {
      config: finalConfig,
      errors: (unrolledAssistant as ConfigResult<AssistantUnrolled>).errors,
      configLoadInterrupted: (
        unrolledAssistant as ConfigResult<AssistantUnrolled>
      ).configLoadInterrupted,
    };
  }

  return finalConfig;
}

export async function unrollBlocks(
  assistant: ConfigYaml,
  registry: Registry,
  injectBlocks: PackageIdentifier[] | undefined,
  asConfigError: boolean,
): Promise<AssistantUnrolled | ConfigResult<AssistantUnrolled>> {
  const errors: ConfigValidationError[] = [];

  const unrolledAssistant: AssistantUnrolled = {
    name: assistant.name,
    version: assistant.version,
  };

  const sections: (keyof Omit<
    ConfigYaml,
    "name" | "version" | "rules" | "schema" | "metadata"
  >)[] = ["models", "context", "data", "mcpServers", "prompts", "docs"];

  // For each section, replace "uses/with" blocks with the real thing
  for (const section of sections) {
    if (assistant[section]) {
      const sectionBlocks: any[] = [];

      for (const unrolledBlock of assistant[section]) {
        // "uses/with" block
        if ("uses" in unrolledBlock) {
          try {
            const blockConfigYaml = await resolveBlock(
              decodePackageIdentifier(unrolledBlock.uses),
              unrolledBlock.with,
              registry,
            );
            const block = blockConfigYaml[section]?.[0];
            if (block) {
              sectionBlocks.push(
                mergeOverrides(block, unrolledBlock.override ?? {}),
              );
            }
          } catch (err) {
            let msg = "";
            if (
              typeof unrolledBlock.uses !== "string" &&
              "filePath" in unrolledBlock.uses
            ) {
              msg = `${(err as Error).message}.\n> ${unrolledBlock.uses.filePath}`;
            } else {
              msg = `${(err as Error).message}.\n> ${JSON.stringify(unrolledBlock.uses)}`;
            }

            errors.push({
              fatal: false,
              message: msg,
            });

            console.error(
              `Failed to unroll block ${JSON.stringify(unrolledBlock.uses)}: ${(err as Error).message}`,
            );
            sectionBlocks.push(null);
          }
        } else {
          // Normal block
          sectionBlocks.push(unrolledBlock);
        }
      }

      unrolledAssistant[section] = sectionBlocks;
    }
  }

  // Rules are a bit different because they can be strings, so handle separately
  if (assistant.rules) {
    const rules: (Rule | null)[] = [];
    for (const rule of assistant.rules) {
      if (typeof rule === "string" || !("uses" in rule)) {
        rules.push(rule);
      } else if ("uses" in rule) {
        try {
          const blockConfigYaml = await resolveBlock(
            decodePackageIdentifier(rule.uses),
            rule.with,
            registry,
          );
          const block = blockConfigYaml.rules?.[0];
          if (block) {
            rules.push(block);
          }
        } catch (err) {
          errors.push({
            fatal: false,
            message: `${(err as Error).message}:\n${rule.uses}`,
          });

          console.error(
            `Failed to unroll block ${rule.uses}: ${(err as Error).message}`,
          );
          rules.push(null);
        }
      }
    }

    unrolledAssistant.rules = rules;
  }

  // Add injected blocks
  for (const injectBlock of injectBlocks ?? []) {
    try {
      const blockConfigYaml = await registry.getContent(injectBlock);
      const parsedBlock = parseConfigYaml(blockConfigYaml);
      const blockType = getBlockType(parsedBlock);
      const resolvedBlock = await resolveBlock(
        injectBlock,
        undefined,
        registry,
      );

      if (blockType) {
        if (!unrolledAssistant[blockType]) {
          unrolledAssistant[blockType] = [];
        }
        unrolledAssistant[blockType]?.push(
          ...(resolvedBlock[blockType] as any),
        );
      }
    } catch (err) {
      let msg = "";
      if (injectBlock.uriType === "file") {
        msg = `${(err as Error).message}.\n> ${injectBlock.filePath}`;
      } else {
        msg = `${(err as Error).message}.\n> ${injectBlock.fullSlug}`;
      }
      errors.push({
        fatal: false,
        message: msg,
      });

      console.error(
        `Failed to unroll block ${JSON.stringify(injectBlock)}: ${(err as Error).message}`,
      );
    }
  }

  if (asConfigError) {
    const configResult: ConfigResult<AssistantUnrolled> = {
      config: undefined,
      errors: undefined,
      configLoadInterrupted: false,
    };
    configResult.config = unrolledAssistant;
    if (errors.length > 0) {
      configResult.errors = errors;
    }
    return configResult;
  }

  return unrolledAssistant;
}

export async function resolveBlock(
  id: PackageIdentifier,
  inputs: Record<string, string> | undefined,
  registry: Registry,
): Promise<AssistantUnrolled> {
  // Retrieve block raw yaml
  const rawYaml = await registry.getContent(id);

  if (rawYaml === undefined) {
    throw new Error(`Block ${packageIdentifierToShorthandSlug(id)} not found`);
  }

  // Convert any input secrets to FQSNs (they get FQSNs as if they are in the block. This is so that we know when to use models add-on / free trial secrets)
  const renderedInputs = inputsToFQSNs(inputs || {}, id);

  // Render template variables
  const templatedYaml = renderTemplateData(rawYaml, {
    inputs: renderedInputs,
    secrets: extractFQSNMap(rawYaml, [id]),
  });

  // Try to parse as YAML first, then as markdown rule if that fails
  let parsedYaml: AssistantUnrolled;
  try {
    parsedYaml = parseBlock(templatedYaml);
  } catch (yamlError) {
    // If YAML parsing fails, try parsing as markdown rule
    try {
      const rule = markdownToRule(templatedYaml);
      // Convert the rule object to the expected format
      parsedYaml = {
        name: rule.name,
        version: "1.0.0",
        rules: [rule],
      };
    } catch (markdownError) {
      // If both fail, throw the original YAML error
      throw yamlError;
    }
  }

  return parsedYaml;
}

function inputsToFQSNs(
  inputs: Record<string, string>,
  blockIdentifier: PackageIdentifier,
): Record<string, string> {
  const renderedInputs: Record<string, string> = {};
  for (const [key, value] of Object.entries(inputs)) {
    renderedInputs[key] = renderTemplateData(value, {
      secrets: extractFQSNMap(value, [blockIdentifier]),
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

function formatZodError(error: any): string {
  if (error.errors && Array.isArray(error.errors)) {
    return error.errors
      .map((e: any) => {
        const path = e.path.length > 0 ? `${e.path.join(".")}: ` : "";
        return `${path}${e.message}`;
      })
      .join(", ");
  }
  return error.message || "Validation failed";
}
