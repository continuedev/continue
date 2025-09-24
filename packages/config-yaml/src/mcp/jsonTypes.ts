import z from "zod";

// This is the schema for an entry in e.g. Claude Desktop, Claude code mcp config
const httpOrSseMcpJsonSchema = z.object({
  type: z.union([z.literal("sse"), z.literal("http")]).optional(),
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
});
export type HttpMcpJsonConfig = z.infer<typeof httpOrSseMcpJsonSchema>;
export type SseMcpJsonConfig = z.infer<typeof httpOrSseMcpJsonSchema>;

const stdioMcpJsonSchema = z.object({
  type: z.literal("stdio").optional(),
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  envFile: z.string().optional(),
});
export type StdioMcpJsonConfig = z.infer<typeof stdioMcpJsonSchema>;

const mcpServersJsonSchema = z.union([
  httpOrSseMcpJsonSchema,
  stdioMcpJsonSchema,
]);
export type McpJsonConfig = z.infer<typeof stdioMcpJsonSchema>;

export const mcpServersRecordSchema = z.record(
  z.string(),
  mcpServersJsonSchema,
);
export type McpServersJsonConfigRecord = z.infer<typeof mcpServersRecordSchema>;

export const mcpServerConfigFileSchema = z.object({
  mcpServers: mcpServersRecordSchema,
});
export type McpServersJsonConfigFile = z.infer<typeof stdioMcpJsonSchema>;
