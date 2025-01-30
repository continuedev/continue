import { z } from "zod";
import {
  autocompleteEventAllSchema,
  autocompleteEventV1Schema,
} from "./autocomplete";

// export const devEventDataSchemas = z.object({
//   tokensGenerated: tokensGeneratedDevDataSchema,
//   chat: chatDevDataSchema,
//   quickEdit: quickEditEventData,
//   autocomplete: autocompleteEventData,
// });

export const devEventDataSchemas = z.object({
  autocomplete: z.object({
    all: autocompleteEventAllSchema,
    1: autocompleteEventV1Schema,
  }),
  // chat: z.object({
  //     v1: autocompleteEventV1Schema,
  // }),
  // 2: z.string(),
});

export type DevEventDataSchemas = z.infer<typeof devEventDataSchemas>;
export type DevEventName = keyof DevEventDataSchemas;
export type DevEventAllDataSchema<T extends DevEventName> =
  DevEventDataSchemas[T]["all"];

export type DevDataLogEvent = {
  [K in DevEventName]: {
    schema: K;
    data: DevEventAllDataSchema<K>;
  };
}[DevEventName];

function xxx(val: DevDataLogEvent) {
  console.log(val);
}

export const localDevDataFileNamesMap: Record<DevEventName, string> = {
  //   tokensGenerated: "tokens_generated",
  //   chat: "chat",
  //   quickEdit: "quickEdit",
  autocomplete: "autocomplete",
};
