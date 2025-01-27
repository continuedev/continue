import * as YAML from "yaml";
import { Registry } from "../interfaces/index.js";
import {
  decodeFullSlug,
  encodePackageSlug,
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
} from "../schemas/index.js";

export function parseConfigYaml(configYaml: string): ConfigYaml {
  try {
    const parsed = YAML.parse(configYaml);
    const result = configYamlSchema.parse(parsed);
    return result;
  } catch (e: any) {
    console.log(configYaml);
    throw new Error(`Failed to parse rolled assistant: ${e.message}`);
  }
}

export function parseAssistantUnrolled(configYaml: string): AssistantUnrolled {
  try {
    const parsed = YAML.parse(configYaml);
    const result = assistantUnrolledSchema.parse(parsed);
    return result;
  } catch (e: any) {
    throw new Error(`Failed to parse unrolled assistant: ${e.message}`);
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

export async function unrollAssistant(
  fullSlug: string,
  registry: Registry,
): Promise<AssistantUnrolled> {
  const assistantSlug = decodeFullSlug(fullSlug);

  // Request the content from the registry
  const rawContent = await registry.getContent(assistantSlug);
  return unrollAssistantFromContent(assistantSlug, rawContent, registry);
}

export async function unrollAssistantFromContent(
  assistantSlug: FullSlug,
  rawYaml: string,
  registry: Registry,
): Promise<AssistantUnrolled> {
  // Convert the raw YAML to unrolled config
  const templateData: TemplateData = {
    // no inputs to an assistant
    inputs: {},
    // at this stage, secrets are mapped to a (still templated) FQSN
    secrets: extractFQSNMap(rawYaml, [assistantSlug]),
    // Built-in variables
    continue: {},
  };

  // Render the template
  const templatedYaml = fillTemplateVariables(
    rawYaml,
    flattenTemplateData(templateData),
  );

  // Parse string to Zod-validated YAML
  let parsedYaml = parseConfigYaml(templatedYaml);

  // Unroll blocks
  const unrolledAssistant = await unrollBlocks(
    parsedYaml,
    assistantSlug,
    registry,
  );

  return unrolledAssistant;
}

export async function unrollBlocks(
  assistant: ConfigYaml,
  assistantFullSlug: FullSlug,
  registry: Registry,
): Promise<AssistantUnrolled> {
  const unrolledAssistant: AssistantUnrolled = {
    name: assistant.name,
    version: assistant.version,
  };

  const sections: (keyof Omit<ConfigYaml, "name" | "version" | "rules">)[] = [
    "models",
    "context",
    "data",
    "tools",
    "mcpServers",
    "prompts",
    "docs",
  ];

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
            assistantFullSlug,
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

  // Rules are a bit different because they're just strings, so handle separately
  if (assistant.rules) {
    const rules: string[] = [];
    for (const rule of assistant.rules) {
      if (typeof rule === "string") {
        rules.push(rule);
      } else {
        const blockConfigYaml = await resolveBlock(
          decodeFullSlug(rule.uses),
          rule.with,
          assistantFullSlug,
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
  parentFullSlug: FullSlug,
  registry: Registry,
): Promise<AssistantUnrolled> {
  // Retrieve block raw yaml
  const rawYaml = await registry.getContent(fullSlug);

  // Render template variables
  const templateData: TemplateData = {
    inputs,
    secrets: extractFQSNMap(rawYaml, [parentFullSlug, fullSlug]),
    continue: {},
  };
  const templatedYaml = fillTemplateVariables(
    rawYaml,
    flattenTemplateData(templateData),
  );

  const parsedYaml = parseBlock(templatedYaml);
  return parsedYaml;
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
