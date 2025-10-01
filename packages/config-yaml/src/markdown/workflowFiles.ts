import z from "zod";

/* 
    Experimental/internal config format for workflows
*/
const workflowFileFrontmatterSchema = z.object({
  name: z.string(),
  description: z.string(),
  model: z.string(),
  tools: z.array(z.string()),
  rules: z.array(z.string()),
});
export type WorkflowFileFrontmatter = z.infer<
  typeof workflowFileFrontmatterSchema
>;

const workflowFileSchema = workflowFileFrontmatterSchema.extend({
  prompt: z.string(),
});
export type WorkflowFile = z.infer<typeof workflowFileSchema>;
