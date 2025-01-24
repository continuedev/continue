import z from "zod";

const sharedConfigTabAutoCompleteOptionsSchema = z
  .object({
    disable: z.boolean(),
    useCache: z.boolean(),
    disableInFiles: z.array(z.string()),
    multilineCompletions: z.enum(["always", "never", "auto"]),
  })
  .partial();

export const sharedConfigSchema = z
  .object({
    allowAnonymousTelemetry: z.boolean(),
    disableIndexing: z.boolean(),
    disableSessionTitles: z.boolean(),
    useChromiumForDocsCrawling: z.boolean(),
    readResponseTTS: z.boolean(),
    promptPath: z.string(),
    tabAutocompleteOptions: sharedConfigTabAutoCompleteOptionsSchema,

    // UI-only, and user-specific:
    codeBlockToolbarPosition: z.enum(["top", "bottom"]),
    fontSize: z.number(),
    codeWrap: z.boolean(),
    displayRawMarkdown: z.boolean(),
    showChatScrollbar: z.boolean(),
  })
  .partial();

export type SharedConfigSchema = z.infer<typeof sharedConfigSchema>;

// For security in case of damaged config file, try to salvage any security-related values
export function salvageSharedConfig(sharedConfig: object): SharedConfigSchema {
  const salvagedConfig: SharedConfigSchema = {};
  if ("allowAnonymousTelemetry" in sharedConfig) {
    const val = z.boolean().safeParse(sharedConfig.allowAnonymousTelemetry);
    if (val.success) {
      salvagedConfig.allowAnonymousTelemetry = val.data;
    }
  }
  if ("disableIndexing" in sharedConfig) {
    const val = z.boolean().safeParse(sharedConfig.disableIndexing);
    if (val.success) {
      salvagedConfig.disableIndexing = val.data;
    }
  }
  if ("disableSessionTitles" in sharedConfig) {
    const val = z.boolean().safeParse(sharedConfig.disableSessionTitles);
    if (val.success) {
      salvagedConfig.disableSessionTitles = val.data;
    }
  }
  if ("tabAutocompleteOptions" in sharedConfig) {
    const val = sharedConfigTabAutoCompleteOptionsSchema.safeParse(
      sharedConfig.tabAutocompleteOptions,
    );
    if (val.success) {
      salvagedConfig.tabAutocompleteOptions = val.data;
    }
  }
  return salvagedConfig;
}
