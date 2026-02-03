import * as YAML from "yaml";
import { ZodError } from "zod";
import { mergeConfigYamlRequestOptions, RequestOptions } from "../browser.js";
import { PlatformClient, Registry } from "../interfaces/index.js";
import { encodeSecretLocation } from "../interfaces/SecretResult.js";
import {
  decodeFQSN,
  decodePackageIdentifier,
  encodeFQSN,
  encodePackageIdentifier,
  encodePackageSlug,
  FQSN,
  PackageIdentifier,
  PackageSlug,
  packageSlugsEqual,
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
import { BlockDuplicationDetector } from "./blockDuplicationDetector.js";
import {
  packageIdentifierToShorthandSlug,
  useProxyForUnrenderedSecrets,
} from "./clientRender.js";
import { BlockType, getBlockType } from "./getBlockType.js";

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
    if (
      e instanceof Error &&
      "cause" in e &&
      e.cause === "result.success was false"
    ) {
      throw new Error(`Failed to parse config: ${e.message}`);
    } else if (e instanceof ZodError) {
      throw new Error(`Failed to parse config: ${formatZodError(e)}`);
    } else {
      throw new Error(
        `Failed to parse config: ${e instanceof Error ? e.message : e}`,
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
    throw new Error(`Failed to parse config: ${formatZodError(e)}`);
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
  // Defensive guard against undefined/null/non-string values
  if (!templatedYaml || typeof templatedYaml !== "string") {
    return [];
  }

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
  // Defensive guard against undefined/null/non-string values
  if (!templatedYaml || typeof templatedYaml !== "string") {
    return "";
  }

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
  allowlistedBlocks?: PackageSlug[];
  blocklistedBlocks?: PackageSlug[];
  injectRequestOptions?: RequestOptions;
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

export async function unrollAssistant(
  id: PackageIdentifier,
  registry: Registry,
  options: UnrollAssistantOptions,
): Promise<ConfigResult<AssistantUnrolled>> {
  // Request the content from the registry
  const rawContent = await registry.getContent(id);

  const result = unrollAssistantFromContent(id, rawContent, registry, options);

  return result;
}

export function replaceInputsWithSecrets(yamlContent: string): string {
  const inputsToSecretsMap: Record<string, string> = {};

  getTemplateVariables(yamlContent)
    .filter((v) => v.startsWith("inputs."))
    .forEach((v) => {
      inputsToSecretsMap[v] = `\${{ ${v.replace("inputs.", "secrets.")} }}`;
    });

  return fillTemplateVariables(yamlContent, inputsToSecretsMap);
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
): Promise<ConfigResult<AssistantUnrolled>> {
  // Parse string to Zod-validated YAML
  let parsedYaml = parseMarkdownRuleOrConfigYaml(rawYaml, id);

  // Unroll blocks and convert their secrets to FQSNs
  const {
    config: unrolledAssistant,
    configLoadInterrupted,
    errors,
  } = await unrollBlocks(
    parsedYaml,
    registry,
    options.injectBlocks,
    options.allowlistedBlocks,
    options.blocklistedBlocks,
    options.injectRequestOptions,
  );

  // Back to a string so we can fill in template variables
  const rawUnrolledYaml = YAML.stringify(unrolledAssistant);

  // Convert all of the template variables to FQSNs
  // Secrets from the block will have the assistant slug prepended to the FQSN
  let templatedYaml = renderTemplateData(rawUnrolledYaml, {
    secrets: extractFQSNMap(rawUnrolledYaml, [id]),
  });

  if (!options.renderSecrets) {
    return {
      config: parseAssistantUnrolled(templatedYaml),
      errors: [],
      configLoadInterrupted: false,
    };
  }

  // Render secret values/locations for client
  const secrets = await extractRenderedSecretsMap(
    templatedYaml,
    options.platformClient,
    options.alwaysUseProxy,
  );
  const renderedYaml = renderTemplateData(templatedYaml, { secrets });

  // Parse again and replace models with proxy versions where secrets weren't rendered
  const renderedConfig = useProxyForUnrenderedSecrets(
    parseAssistantUnrolled(renderedYaml),
    id,
    options.orgScopeId,
    options.onPremProxyUrl,
  );

  return { config: renderedConfig, errors, configLoadInterrupted };
}

function isPackageAllowed(
  pkgId: PackageIdentifier,
  allowlistedBlocks?: PackageSlug[],
  blocklistedBlocks?: PackageSlug[],
): boolean {
  // Only "slug" type blocks can be allow/block listed
  if (pkgId.uriType !== "slug") {
    return true;
  }

  const packageSlug = {
    ownerSlug: pkgId.fullSlug.ownerSlug,
    packageSlug: pkgId.fullSlug.packageSlug,
  };

  if (
    allowlistedBlocks &&
    !allowlistedBlocks.some((block) => packageSlugsEqual(block, packageSlug))
  ) {
    return false;
  }

  if (
    blocklistedBlocks &&
    blocklistedBlocks.some((block) => packageSlugsEqual(block, packageSlug))
  ) {
    return false;
  }

  return true;
}

export async function unrollBlocks(
  assistant: ConfigYaml,
  registry: Registry,
  injectBlocks: PackageIdentifier[] | undefined,
  allowlistedBlocks?: PackageSlug[],
  blocklistedBlocks?: PackageSlug[],
  injectRequestOptions?: RequestOptions,
): Promise<ConfigResult<AssistantUnrolled>> {
  const errors: ConfigValidationError[] = [];

  const unrolledAssistant: AssistantUnrolled = {
    name: assistant.name,
    version: assistant.version,
    requestOptions: assistant.requestOptions,
  };

  if (injectRequestOptions) {
    unrolledAssistant.requestOptions = mergeConfigYamlRequestOptions(
      assistant.requestOptions,
      injectRequestOptions,
    );
  } else {
    unrolledAssistant.requestOptions = assistant.requestOptions;
  }

  const sections: (keyof Omit<
    ConfigYaml,
    | "name"
    | "version"
    | "rules"
    | "schema"
    | "metadata"
    | "env"
    | "requestOptions"
  >)[] = ["models", "context", "data", "mcpServers", "prompts", "docs"];

  // Process all sections in parallel
  const sectionPromises = sections.map(async (section) => {
    if (!assistant[section]) {
      return { section, blocks: null };
    }

    // Process all blocks in this section in parallel
    const blockPromises = assistant[section].map(
      async (unrolledBlock, index) => {
        // "uses/with" block
        if ("uses" in unrolledBlock) {
          try {
            const blockIdentifier = decodePackageIdentifier(unrolledBlock.uses);

            if (
              !isPackageAllowed(
                blockIdentifier,
                allowlistedBlocks,
                blocklistedBlocks,
              )
            ) {
              throw new Error(
                `${
                  blockIdentifier.uriType === "slug"
                    ? encodePackageSlug({
                        ownerSlug: blockIdentifier.fullSlug.ownerSlug,
                        packageSlug: blockIdentifier.fullSlug.packageSlug,
                      })
                    : encodePackageIdentifier(blockIdentifier)
                } is block listed and can not be used.`,
              );
            }

            const blockConfigYaml = await resolveBlock(
              blockIdentifier,
              unrolledBlock.with,
              registry,
            );
            const block = blockConfigYaml[section]?.[0];
            if (block) {
              return {
                index,
                block: mergeOverrides(block, unrolledBlock.override ?? {}),
                error: null,
              };
            }
            return { index, block: null, error: null };
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

            console.error(
              `Failed to unroll block ${JSON.stringify(unrolledBlock.uses)}: ${(err as Error).message}`,
            );

            return {
              index,
              block: null,
              error: { fatal: false, message: msg },
            };
          }
        } else {
          // Normal block
          return { index, block: unrolledBlock, error: null };
        }
      },
    );

    const blockResults = await Promise.all(blockPromises);

    // Collect errors and maintain order
    const sectionBlocks: any[] = [];
    const sectionErrors: ConfigValidationError[] = [];

    for (const result of blockResults) {
      if (result.error) {
        sectionErrors.push(result.error);
      }
      sectionBlocks[result.index] = result.block;
    }

    return { section, blocks: sectionBlocks, errors: sectionErrors };
  });

  // Process rules in parallel
  const rulesPromise = assistant.rules
    ? (async () => {
        const rulePromises = assistant.rules!.map(async (rule, index) => {
          if (typeof rule === "string" || !("uses" in rule)) {
            return { index, rule, error: null };
          } else if ("uses" in rule) {
            try {
              const blockConfigYaml = await resolveBlock(
                decodePackageIdentifier(rule.uses),
                rule.with,
                registry,
              );
              const block = blockConfigYaml.rules?.[0];
              return { index, rule: block || null, error: null };
            } catch (err) {
              console.error(
                `Failed to unroll block ${rule.uses}: ${(err as Error).message}`,
              );

              return {
                index,
                rule: null,
                error: {
                  fatal: false,
                  message: `${(err as Error).message}:\n${rule.uses}`,
                },
              };
            }
          }
          return { index, rule: null, error: null };
        });

        const ruleResults = await Promise.all(rulePromises);

        const rules: (Rule | null)[] = [];
        const ruleErrors: ConfigValidationError[] = [];

        for (const result of ruleResults) {
          if (result.error) {
            ruleErrors.push(result.error);
          }
          rules[result.index] = result.rule;
        }

        return { rules, errors: ruleErrors };
      })()
    : Promise.resolve({ rules: undefined, errors: [] });

  // Process injected blocks in parallel
  const injectedBlocksPromise = injectBlocks
    ? (async () => {
        const injectedBlockPromises = injectBlocks.map(async (injectBlock) => {
          try {
            const blockConfigYaml = await registry.getContent(injectBlock);
            // Convert inputs to secrets, then convert secrets to FQSNs using the injected block's identifier
            // This ensures secrets are properly namespaced for proxy resolution (e.g., models add-on)
            const blockConfigYamlWithSecrets =
              replaceInputsWithSecrets(blockConfigYaml);
            const blockConfigYamlWithFQSNs = renderTemplateData(
              blockConfigYamlWithSecrets,
              {
                secrets: extractFQSNMap(blockConfigYamlWithSecrets, [
                  injectBlock,
                ]),
              },
            );
            const resolvedBlock = parseMarkdownRuleOrConfigYaml(
              blockConfigYamlWithFQSNs,
              injectBlock,
            );
            const blockType = getBlockType(resolvedBlock);

            return {
              blockType,
              resolvedBlock,
              source:
                injectBlock.uriType === "file"
                  ? injectBlock.fileUri
                  : undefined,
              error: null,
            };
          } catch (err) {
            let msg = "";
            if (injectBlock.uriType === "file") {
              msg = `${(err as Error).message}.\n> ${injectBlock.fileUri}`;
            } else {
              msg = `${(err as Error).message}.\n> ${injectBlock.fullSlug}`;
            }

            console.error(
              `Failed to unroll block ${JSON.stringify(injectBlock)}: ${(err as Error).message}`,
            );

            return {
              blockType: null,
              resolvedBlock: null,
              error: { fatal: false, message: msg },
            };
          }
        });

        const injectedResults = await Promise.all(injectedBlockPromises);
        const injectedErrors: ConfigValidationError[] = [];
        const injectedBlocks: {
          blockType: BlockType;
          resolvedBlock: any;
          source?: string;
        }[] = [];

        for (const result of injectedResults) {
          if (result.error) {
            injectedErrors.push(result.error);
          } else if (result.blockType && result.resolvedBlock) {
            injectedBlocks.push({
              blockType: result.blockType,
              resolvedBlock: result.resolvedBlock,
              source: result.source,
            });
          }
        }

        return { injectedBlocks, errors: injectedErrors };
      })()
    : Promise.resolve({ injectedBlocks: [], errors: [] });

  // Wait for all parallel operations to complete
  const [sectionResults, rulesResult, injectedResult] = await Promise.all([
    Promise.all(sectionPromises),
    rulesPromise,
    injectedBlocksPromise,
  ]);

  // Collect all errors
  for (const sectionResult of sectionResults) {
    if (sectionResult.errors) {
      errors.push(...sectionResult.errors);
    }
  }
  errors.push(...rulesResult.errors);
  errors.push(...injectedResult.errors);

  const detector = new BlockDuplicationDetector();

  // Assign section results
  for (const sectionResult of sectionResults) {
    if (sectionResult.blocks) {
      unrolledAssistant[sectionResult.section] = sectionResult.blocks.filter(
        (block) => !detector.isDuplicated(block, sectionResult.section),
      );
    }
  }

  // Assign rules result
  if (rulesResult.rules) {
    unrolledAssistant.rules = rulesResult.rules.filter(
      (rule) => !detector.isDuplicated(rule, "rules"),
    );
  }

  // Add injected blocks
  for (const {
    blockType,
    resolvedBlock,
    source,
  } of injectedResult.injectedBlocks) {
    const key = blockType;
    if (!unrolledAssistant[key]) {
      unrolledAssistant[key] = [];
    }

    const filteredBlocks = injectLocalSourceFile(
      key,
      resolvedBlock,
      source,
    ).filter((block: any) => !detector.isDuplicated(block, blockType));
    unrolledAssistant[key]?.push(...filteredBlocks);
  }

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

function injectLocalSourceFile(
  blockType: BlockType,
  resolvedBlock: any,
  source?: string,
): (any & { source?: string })[] {
  const blocks: any[] = resolvedBlock[blockType] ?? [];
  if (source === undefined) {
    // If no source is provided, return blocks as is
    return blocks;
  }
  if (blockType === "rules") {
    // For rules, we need to ensure they are wrapped in an object with a `source
    return blocks.map((block) => {
      if (typeof block === "string") {
        const rule = {
          sourceFile: source,
          name: block,
          rule: block,
        } as Rule;
        return rule;
      } else if (typeof block === "object") {
        block.sourceFile = source;
      }
      return block;
    });
  }
  // For other block types, we can directly inject the source file
  return blocks.map((block) => ({
    ...block,
    sourceFile: source,
  }));
}

export async function resolveBlock(
  id: PackageIdentifier,
  inputs: Record<string, string | undefined> | undefined,
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

  // Add source slug for mcp servers
  const parsed = parseMarkdownRuleOrAssistantUnrolled(templatedYaml, id);
  if (
    id.uriType === "slug" &&
    "mcpServers" in parsed &&
    parsed.mcpServers?.[0]
  ) {
    parsed.mcpServers[0].sourceSlug = `${id.fullSlug.ownerSlug}/${id.fullSlug.packageSlug}`;
  }

  return parsed;
}

export function parseMarkdownRuleOrAssistantUnrolled(
  content: string,
  id: PackageIdentifier,
): AssistantUnrolled {
  return parseYamlOrMarkdownRule<AssistantUnrolled>(content, id, parseBlock);
}

function parseMarkdownRuleOrConfigYaml(
  content: string,
  id: PackageIdentifier,
): ConfigYaml {
  return parseYamlOrMarkdownRule<ConfigYaml>(content, id, parseConfigYaml);
}

function parseYamlOrMarkdownRule<T>(
  content: string,
  id: PackageIdentifier,
  parseYamlFn: (content: string) => T,
): T {
  let parsedYaml: T;
  try {
    // Try to parse as YAML first, then as markdown rule if that fails
    parsedYaml = parseYamlFn(content);
  } catch (yamlError) {
    if (
      id.uriType === "file" &&
      [".yaml", ".yml"].some((ext) => id.fileUri.endsWith(ext))
    ) {
      throw yamlError;
    }
    // If YAML parsing fails, try parsing as markdown rule
    try {
      const rule = markdownToRule(content, id);
      // Convert the rule object to the expected format
      parsedYaml = { name: rule.name, version: "1.0.0", rules: [rule] } as T;
    } catch (markdownError) {
      // If both fail, throw the original YAML error
      throw yamlError;
    }
  }
  return parsedYaml;
}

function inputsToFQSNs(
  inputs: Record<string, string | undefined>,
  blockIdentifier: PackageIdentifier,
): Record<string, string> {
  const renderedInputs: Record<string, string> = {};
  for (const [key, value] of Object.entries(inputs)) {
    // Skip undefined, null, or non-string values
    if (value === undefined || value === null || typeof value !== "string") {
      console.warn(
        `Skipping input "${key}" with invalid value type: ${typeof value}. Expected string.`,
      );
      continue;
    }

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
