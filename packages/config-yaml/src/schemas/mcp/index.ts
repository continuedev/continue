import { z } from "zod";
import { requestOptionsSchema } from "../../schemas/models.js";

const baseMcpServerSchema = z.object({
  name: z.string(),
  serverName: z.string().optional(),
  faviconUrl: z.string().optional(),
  sourceFile: z.string().optional(), // Added during loading
  sourceSlug: z.string().optional(), // Added during loading
  connectionTimeout: z.number().gt(0).optional(),
});

const stdioMcpServerSchema = baseMcpServerSchema.extend({
  command: z.string(),
  type: z.literal("stdio").optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  cwd: z.string().optional(),
});
export type StdioMcpServer = z.infer<typeof stdioMcpServerSchema>;

const sseOrHttpMcpServerSchema = baseMcpServerSchema.extend({
  url: z.string(), // .url() fails with e.g. IP addresses
  type: z.union([z.literal("sse"), z.literal("streamable-http")]).optional(),
  apiKey: z.string().optional(),
  requestOptions: requestOptionsSchema.optional(),
  /** OAuth sign-in settings for servers that require it. */
  oauth: z
    .object({
      /** Port of the local redirect server used while signing in (default 3000). */
      callbackPort: z.number().int().min(1).max(65535).optional(),
    })
    .optional(),
});
export type SseMcpServer = z.infer<typeof sseOrHttpMcpServerSchema>;
export type HttpMcpServer = z.infer<typeof sseOrHttpMcpServerSchema>;

export const mcpServerSchema = z.union([
  stdioMcpServerSchema,
  sseOrHttpMcpServerSchema,
]);
export type MCPServer = z.infer<typeof mcpServerSchema>;

export const partialMcpServerSchema = z.union([
  stdioMcpServerSchema.partial(),
  sseOrHttpMcpServerSchema.partial(),
]);
export type PartialMCPServer = z.infer<typeof partialMcpServerSchema>;
