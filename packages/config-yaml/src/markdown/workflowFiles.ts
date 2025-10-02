import * as YAML from "yaml";
import z from "zod";
import { parseMarkdownRule } from "./markdownToRule.js";

/* 
    Experimental/internal config format for workflows
*/
const workflowFileFrontmatterSchema = z.object({
  name: z.string().min(1, "Name cannot be empty"),
  description: z.string().optional(),
  model: z.string().optional(),
  tools: z.string().optional(), // TODO also accept yaml array
  rules: z.string().optional(), // TODO also accept yaml array
});
export type WorkflowFileFrontmatter = z.infer<
  typeof workflowFileFrontmatterSchema
>;

const workflowFileSchema = workflowFileFrontmatterSchema.extend({
  prompt: z.string(),
});
export type WorkflowFile = z.infer<typeof workflowFileSchema>;

/**
 * Parses and validates a workflow file from markdown content
 * Workflow files must have frontmatter with at least a name
 */
export function parseWorkflowFile(content: string): WorkflowFile {
  const { frontmatter, markdown } = parseMarkdownRule(content);

  if (!frontmatter.name) {
    throw new Error(
      "Workflow file must contain YAML frontmatter with a 'name' field",
    );
  }

  const validationResult = workflowFileFrontmatterSchema.safeParse(frontmatter);

  if (!validationResult.success) {
    const errorDetails = validationResult.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new Error(`Invalid workflow file frontmatter: ${errorDetails}`);
  }

  return {
    ...validationResult.data,
    prompt: markdown,
  };
}

/**
 * Serializes a Workflow file back to markdown with YAML frontmatter
 */
export function serializeWorkflowFile(workflowFile: WorkflowFile): string {
  const { prompt, ...frontmatter } = workflowFile;

  // Filter out undefined values from frontmatter
  const cleanFrontmatter = Object.fromEntries(
    Object.entries(frontmatter).filter(([, value]) => value !== undefined),
  );

  const yamlFrontmatter = YAML.stringify(cleanFrontmatter).trim();

  return `---\n${yamlFrontmatter}\n---\n${prompt}`;
}
