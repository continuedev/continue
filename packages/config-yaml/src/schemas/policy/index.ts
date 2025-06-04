import * as z from "zod";

export const policySchema = z.object({
  allowAnonymousTelemetry: z.boolean().optional(),
  allowLocalConfigFile: z.boolean().optional(),
  allowOtherOrganizations: z.boolean().optional(),
});

export type Policy = z.infer<typeof policySchema>;
