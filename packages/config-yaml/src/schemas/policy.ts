import * as z from "zod";

export const policySchema = z.object({
  allowAnonymousTelemetry: z.boolean().optional(),
  allowOtherOrgs: z.boolean().optional(),
  allowCodebaseIndexing: z.boolean().optional(),
  allowMcpServers: z.boolean().optional(),
  // allowLocalConfigFile: z.boolean().optional(),
});

export type Policy = z.infer<typeof policySchema>;
