import { z } from "zod";
import { requestOptionsSchema } from "../models.js";
import { autocompleteEventAllSchema } from "./autocomplete/index.js";
import {
  autocompleteEventSchema_0_1_0,
  autocompleteEventSchema_0_1_0_noCode,
} from "./autocomplete/v0.1.0.js";
import {
  autocompleteEventSchema_0_2_0,
  autocompleteEventSchema_0_2_0_noCode,
} from "./autocomplete/v0.2.0.js";
import { chatFeedbackEventAllSchema } from "./chatFeedback/index.js";
import {
  chatFeedbackEventSchema_0_1_0,
  chatFeedbackEventSchema_0_1_0_noCode,
} from "./chatFeedback/v0.1.0.js";
import {
  chatFeedbackEventSchema_0_2_0,
  chatFeedbackEventSchema_0_2_0_noCode,
} from "./chatFeedback/v0.2.0.js";
import { chatInteractionEventAllSchema } from "./chatInteraction/index.js";
import {
  chatInteractionEventSchema_0_2_0,
  chatInteractionEventSchema_0_2_0_noCode,
} from "./chatInteraction/v0.2.0.js";
import { editInteractionEventAllSchema } from "./editInteraction/index.js";
import {
  editInteractionEventSchema_0_2_0,
  editInteractionEventSchema_0_2_0_noCode,
} from "./editInteraction/v0.2.0.js";
import { editOutcomeEventAllSchema } from "./editOutcome/index.js";
import {
  editOutcomeEventSchema_0_2_0,
  editOutcomeEventSchema_0_2_0_noCode,
} from "./editOutcome/v0.2.0.js";
import { nextEditOutcomeEventAllSchema } from "./nextEditOutcome/index.js";
import {
  nextEditOutcomeEventSchema_0_2_0,
  nextEditOutcomeEventSchema_0_2_0_noCode,
} from "./nextEditOutcome/v0.2.0.js";
import { nextEditEventAllSchema } from "./nextEditWithHistory/index.js";
import {
  nextEditEventSchema_0_2_0,
  nextEditEventSchema_0_2_0_noCode,
} from "./nextEditWithHistory/v0.2.0.js";
import { quickEditEventAllSchema } from "./quickEdit/index.js";
import {
  quickEditEventSchema_0_1_0,
  quickEditEventSchema_0_1_0_noCode,
} from "./quickEdit/v0.1.0.js";
import { tokensGeneratedEventAllSchema } from "./tokensGenerated/index.js";
import {
  tokensGeneratedEventSchema_0_1_0,
  tokensGeneratedEventSchema_0_1_0_noCode,
} from "./tokensGenerated/v0.1.0.js";
import {
  tokensGeneratedEventSchema_0_2_0,
  tokensGeneratedEventSchema_0_2_0_noCode,
} from "./tokensGenerated/v0.2.0.js";
import { toolUsageEventAllSchema } from "./toolUsage/index.js";
import {
  toolUsageEventSchema_0_2_0,
  toolUsageEventSchema_0_2_0_noCode,
} from "./toolUsage/v0.2.0.js";

const semverRegex =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

const dataLevel = z.union([z.literal("all"), z.literal("noCode")]);

export const dataSchema = z.object({
  name: z.string(),
  destination: z.string(),
  schema: z.string().regex(semverRegex, {
    message: "Version must follow semver format, e.g. 0.2.0",
  }),
  level: dataLevel.optional(),
  events: z.array(z.string()).optional(), // Could do literals e.g. "autocomplete", "chat" but want to allow some flexibility later
  requestOptions: requestOptionsSchema.optional(),
  apiKey: z.string().optional(),
});

export type DataDestination = z.infer<typeof dataSchema>;
export type DataLogLevel = z.infer<typeof dataLevel>;

// Schemas for data that the log function should have
// In order to build event bodies for ALL versions of an event
const devEventAllVersionDataSchemas = z.object({
  autocomplete: autocompleteEventAllSchema,
  quickEdit: quickEditEventAllSchema,
  chatFeedback: chatFeedbackEventAllSchema,
  tokensGenerated: tokensGeneratedEventAllSchema,
  chatInteraction: chatInteractionEventAllSchema,
  editInteraction: editInteractionEventAllSchema,
  editOutcome: editOutcomeEventAllSchema,
  nextEditOutcome: nextEditOutcomeEventAllSchema,
  nextEditWithHistory: nextEditEventAllSchema,
  toolUsage: toolUsageEventAllSchema,
});

// Version and level specific schemas are organized here
export const devDataVersionedSchemas = {
  ["0.1.0" as string]: {
    all: {
      autocomplete: autocompleteEventSchema_0_1_0,
      quickEdit: quickEditEventSchema_0_1_0,
      chatFeedback: chatFeedbackEventSchema_0_1_0,
      tokensGenerated: tokensGeneratedEventSchema_0_1_0,
    },
    noCode: {
      autocomplete: autocompleteEventSchema_0_1_0_noCode,
      quickEdit: quickEditEventSchema_0_1_0_noCode,
      chatFeedback: chatFeedbackEventSchema_0_1_0_noCode,
      tokensGenerated: tokensGeneratedEventSchema_0_1_0_noCode,
    },
  },
  ["0.2.0" as string]: {
    all: {
      autocomplete: autocompleteEventSchema_0_2_0,
      chatFeedback: chatFeedbackEventSchema_0_2_0,
      tokensGenerated: tokensGeneratedEventSchema_0_2_0,
      chatInteraction: chatInteractionEventSchema_0_2_0,
      editInteraction: editInteractionEventSchema_0_2_0,
      editOutcome: editOutcomeEventSchema_0_2_0,
      nextEditOutcome: nextEditOutcomeEventSchema_0_2_0,
      nextEditWithHistory: nextEditEventSchema_0_2_0,
      toolUsage: toolUsageEventSchema_0_2_0,
    },
    noCode: {
      autocomplete: autocompleteEventSchema_0_2_0_noCode,
      chatFeedback: chatFeedbackEventSchema_0_2_0_noCode,
      tokensGenerated: tokensGeneratedEventSchema_0_2_0_noCode,
      chatInteraction: chatInteractionEventSchema_0_2_0_noCode,
      editInteraction: editInteractionEventSchema_0_2_0_noCode,
      editOutcome: editOutcomeEventSchema_0_2_0_noCode,
      nextEditOutcome: nextEditOutcomeEventSchema_0_2_0_noCode,
      nextEditWithHistory: nextEditEventSchema_0_2_0_noCode,
      toolUsage: toolUsageEventSchema_0_2_0_noCode,
    },
  },
};

type DevEventDataSchemas = z.infer<typeof devEventAllVersionDataSchemas>;
export type DevEventName = keyof DevEventDataSchemas;
type DevEventAllVersionsSchema<T extends DevEventName> = DevEventDataSchemas[T];

export type DevDataLogEvent = {
  [K in DevEventName]: {
    name: K;
    data: Omit<
      DevEventAllVersionsSchema<K>,
      | "eventName"
      | "schema"
      | "timestamp"
      | "userId"
      | "userAgent"
      | "selectedProfileId"
    >;
  };
}[DevEventName];

export const allDevEventNames = Object.keys(
  devEventAllVersionDataSchemas.shape,
) as DevEventName[];
