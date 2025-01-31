import { z, ZodObject } from "zod";
import { autocompleteEventAllSchema } from "./autocomplete/index.js";
import { requestOptionsSchema } from "../models.js";
import {
  autocompleteEventSchema_0_1_0,
  autocompleteEventSchema_0_1_0_noPII,
} from "./autocomplete/0.1.0.js";
import {
  quickEditEventSchema_0_1_0,
  quickEditEventSchema_0_1_0_noPII,
} from "./quickEdit/0.1.0.js";
import {
  autocompleteEventSchema_0_2_0,
  autocompleteEventSchema_0_2_0_noPII,
} from "./autocomplete/0.2.0.js";
import { quickEditEventAllSchema } from "./quickEdit/index.js";

const semverRegex =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

const dataLevel = z.union([z.literal("all"), z.literal("noPII")]);

export const dataSchema = z.object({
  name: z.string(),
  destination: z.string().url(),
  version: z.string().regex(semverRegex, {
    message: "Version must follow semver format, e.g. 0.2.0",
  }),
  level: dataLevel.optional(), // Could do literals
  events: z.array(z.string()).optional(), // Could do literals e.g. "autocomplete", "chat" but want to allow some flexibility later
  requestOptions: requestOptionsSchema.optional(),
  apiKey: z.string().optional(),
});

export type DataDestination = z.infer<typeof dataSchema>;
export type DataLogLevel = z.infer<typeof dataLevel>;

// export const devEventDataSchemas = z.object({
//   tokensGenerated: tokensGeneratedDevDataSchema,
//   chat: chatDevDataSchema,
//   quickEdit: quickEditEventData,
//   autocomplete: autocompleteEventData,
// });

const devEventAllVersionDataSchemas = z.object({
  autocomplete: autocompleteEventAllSchema,
  quickEdit: quickEditEventAllSchema,
});

// Here all schemas are organized by version and level
export const devDataVersionedSchemas = {
  ["0.1.0" as string]: {
    all: {
      autocomplete: autocompleteEventSchema_0_1_0,
      quickEdit: quickEditEventSchema_0_1_0,
    },
    noPII: {
      autocomplete: autocompleteEventSchema_0_1_0_noPII,
      quickEdit: quickEditEventSchema_0_1_0_noPII,
    },
  },
  ["0.2.0" as string]: {
    all: {
      autocomplete: autocompleteEventSchema_0_2_0,
      // chat: blockSchema,
      // edit: blockItemWrapperSchema,
      // tokensGenerated: blockSchema,
    },
    noPII: {
      autocomplete: autocompleteEventSchema_0_2_0_noPII,
    },
  },
};

type DevEventDataSchemas = z.infer<typeof devEventAllVersionDataSchemas>;
type DevEventName = keyof DevEventDataSchemas;
type DevEventAllVersionsSchema<T extends DevEventName> = DevEventDataSchemas[T];

export type DevDataLogEvent = {
  [K in DevEventName]: {
    schema: K;
    data: DevEventAllVersionsSchema<K>;
  };
}[DevEventName];

export const allDevEventNames = Object.keys(
  devEventAllVersionDataSchemas.shape,
) as DevEventName[];
