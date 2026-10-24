import { ToolCallDelta } from "..";

export function safeParseToolCallArgs(
  toolCall: ToolCallDelta,
): Record<string, any> {
  const args = toolCall.function?.arguments;

  if (
    args &&
    typeof args === "object" &&
    !Array.isArray(args) &&
    Object.keys(args).length > 0
  ) {
    return args;
  }

  try {
    return JSON.parse(toolCall.function?.arguments?.trim() || "{}");
  } catch (e) {
    //console.error(
    //  `Failed to parse tool call arguments:\nTool call: ${toolCall.function?.name + " " + toolCall.id}\nArgs:${toolCall.function?.arguments}\n`,
    //);
    return {};
  }
}

type JsonType =
  | "null"
  | "boolean"
  | "integer"
  | "number"
  | "string"
  | "array"
  | "object";

const JSON_TYPES: string[] = [
  "null",
  "boolean",
  "integer",
  "number",
  "string",
  "array",
  "object",
];

// "integer" for integral numbers, "number" for all other numbers
function getJsonType(value: unknown): JsonType {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? "integer" : "number";
  }
  return typeof value as JsonType;
}

// Schema nodes visited per argument; each $ref is expanded once, so real
// schemas need few, and larger or adversarial ones are left unanalyzed
const MAX_SCHEMA_NODES = 1000;

interface SchemaTraversal {
  root: Record<string, any>;
  nodesLeft: number;
  refTypes: Map<string, Set<JsonType> | undefined>;
  activeRefs: Set<string>;
  // Set when the schema cannot be analyzed safely; the argument is kept as-is
  unsupported: boolean;
}

// $id (or id in draft 4) starts a nested schema resource, whose references
// resolve against its own base URI instead of the root
function hasResourceId(node: unknown): boolean {
  if (typeof node !== "object" || node === null) {
    return false;
  }
  const { $id, id } = node as Record<string, unknown>;
  return typeof $id === "string" || typeof id === "string";
}

function resolveLocalRef(root: Record<string, any>, ref: string): unknown {
  if (ref !== "#" && !ref.startsWith("#/")) {
    return undefined;
  }
  let node: unknown = root;
  for (const token of ref.split("/").slice(1)) {
    const key = token.replace(/~1/g, "/").replace(/~0/g, "~");
    if (
      typeof node !== "object" ||
      node === null ||
      !Object.hasOwn(node, key)
    ) {
      return undefined;
    }
    node = (node as Record<string, unknown>)[key];
    if (hasResourceId(node)) {
      return undefined;
    }
  }
  return node;
}

/**
 * Returns the JSON types a schema accepts, or undefined when it may accept
 * any type (no type constraint, ...). Keywords that can only narrow this
 * (not, if/then/else, $ref siblings, ...) are ignored, so the result never
 * omits a type the schema accepts. Schemas that are too large, recursive or
 * use references that cannot be resolved within the root resource set
 * traversal.unsupported instead.
 */
function getAcceptedTypes(
  schema: unknown,
  traversal: SchemaTraversal,
): Set<JsonType> | undefined {
  if (traversal.unsupported || --traversal.nodesLeft < 0) {
    traversal.unsupported = true;
    return undefined;
  }
  if (schema === false) {
    return new Set();
  }
  if (typeof schema !== "object" || schema === null || Array.isArray(schema)) {
    return undefined;
  }
  const s = schema as Record<string, any>;

  if (
    (s !== traversal.root && hasResourceId(s)) ||
    "$dynamicRef" in s ||
    "$recursiveRef" in s
  ) {
    traversal.unsupported = true;
    return undefined;
  }
  if (s.$ref !== undefined) {
    return getRefTypes(s.$ref, traversal);
  }

  const constraints: (Set<JsonType> | undefined)[] = [];
  if (s.type !== undefined) {
    const names: unknown[] = Array.isArray(s.type) ? s.type : [s.type];
    constraints.push(
      names.every((name) => JSON_TYPES.includes(name as string))
        ? new Set(
            names.flatMap((name) =>
              name === "number" ? ["integer", "number"] : [name as JsonType],
            ) as JsonType[],
          )
        : undefined,
    );
  }
  if (Array.isArray(s.enum)) {
    constraints.push(new Set(s.enum.map(getJsonType)));
  }
  if ("const" in s) {
    constraints.push(new Set([getJsonType(s.const)]));
  }
  for (const keyword of ["anyOf", "oneOf"]) {
    if (Array.isArray(s[keyword])) {
      const branches: (Set<JsonType> | undefined)[] = s[keyword].map(
        (branch: unknown) => getAcceptedTypes(branch, traversal),
      );
      constraints.push(
        branches.every((types): types is Set<JsonType> => !!types)
          ? new Set(branches.flatMap((types) => [...types]))
          : undefined,
      );
    }
  }
  if (Array.isArray(s.allOf)) {
    for (const branch of s.allOf) {
      constraints.push(getAcceptedTypes(branch, traversal));
    }
  }

  let accepted: Set<JsonType> | undefined;
  for (const types of constraints) {
    if (types) {
      accepted = accepted
        ? new Set([...accepted].filter((type) => types.has(type)))
        : types;
    }
  }
  return accepted;
}

function getRefTypes(
  ref: unknown,
  traversal: SchemaTraversal,
): Set<JsonType> | undefined {
  // Non-string, or pointing back into a schema that is being expanded
  if (typeof ref !== "string" || traversal.activeRefs.has(ref)) {
    traversal.unsupported = true;
    return undefined;
  }
  if (traversal.refTypes.has(ref)) {
    return traversal.refTypes.get(ref);
  }
  const target = resolveLocalRef(traversal.root, ref);
  if (target === undefined) {
    traversal.unsupported = true;
    return undefined;
  }
  traversal.activeRefs.add(ref);
  const types = getAcceptedTypes(target, traversal);
  traversal.activeRefs.delete(ref);
  traversal.refTypes.set(ref, types);
  return types;
}

// Accepted types of one argument's schema, or undefined to keep the argument
function getPropertyTypes(
  propSchema: unknown,
  root: Record<string, any>,
): Set<JsonType> | undefined {
  const traversal: SchemaTraversal = {
    root,
    nodesLeft: MAX_SCHEMA_NODES,
    refTypes: new Map(),
    activeRefs: new Set(),
    unsupported: false,
  };
  const types = getAcceptedTypes(propSchema, traversal);
  return traversal.unsupported ? undefined : types;
}

/**
 * Parses a JSON-serialized argument (e.g. "[\"a.ts\"]", "42", "false").
 * The first element is false unless the parsed value has an accepted type
 * and can be represented without loss.
 */
function parseSerializedArg(
  value: string,
  accepted: Set<JsonType>,
): [boolean, unknown] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    // Same case-insensitive boolean strings as getBooleanArg
    const literal = value.trim().toLowerCase();
    if (literal !== "true" && literal !== "false") {
      return [false, undefined];
    }
    parsed = literal === "true";
  }
  if (
    typeof parsed === "number" &&
    !(Number.isInteger(parsed)
      ? Number.isSafeInteger(parsed)
      : Number.isFinite(parsed))
  ) {
    return [false, undefined];
  }
  return [accepted.has(getJsonType(parsed)), parsed];
}

/**
 * Coerce parsed args to match the tool's input schema types.
 * JSON.parse() deeply parses all values, so string-typed parameters
 * that contain valid JSON (e.g. file content for a .json file) get
 * converted to objects. This checks the schema and re-stringifies
 * any values that should be strings.
 *
 * Conversely, some models and providers send arrays, objects, numbers and
 * booleans as JSON text (e.g. {"paths": "[\"a.ts\"]"}). A string is parsed
 * only when the schema rejects strings and accepts the parsed value's type;
 * anything else is passed through for the tool to validate.
 */
export function coerceArgsToSchema(
  args: Record<string, any>,
  schema?: Record<string, any>,
): Record<string, any> {
  if (!schema?.properties) {
    return args;
  }

  const coerced = { ...args };
  for (const [key, value] of Object.entries(coerced)) {
    const propSchema = schema.properties[key];
    if (!propSchema) {
      continue;
    }

    if (
      propSchema.type === "string" &&
      typeof value === "object" &&
      value !== null
    ) {
      try {
        coerced[key] = JSON.stringify(value);
      } catch {
        // leave as-is if stringify fails
      }
    } else if (typeof value === "string") {
      const accepted = getPropertyTypes(propSchema, schema);
      if (accepted && !accepted.has("string")) {
        const [isAccepted, parsed] = parseSerializedArg(value, accepted);
        if (isAccepted) {
          coerced[key] = parsed;
        }
      }
    }
  }

  return coerced;
}

export function getStringArg(
  args: any,
  argName: string,
  allowEmpty = false,
): string {
  if (!args || !(argName in args)) {
    throw new Error(
      `\`${argName}\` argument is required${allowEmpty ? "" : " and must not be empty or whitespace-only"}. (type string)`,
    );
  }

  let value = args[argName];

  // Handle case where JSON was parsed into an object by the tool call parser.
  // If the arguments to the tool call are valid JSON (e.g. the model attempts to create a .json file)
  // the earlier call to JSON.parse() will have deeply parsed the returned arguments.
  // If that has happened, convert back to string.
  if (typeof value === "object" && value !== null) {
    try {
      value = JSON.stringify(value);
      return value;
    } catch (e) {
      //Swallow this, because it might be fine later.
    }
  }

  if (typeof value !== "string") {
    throw new Error(
      `\`${argName}\` argument is required${allowEmpty ? "" : " and must not be empty or whitespace-only"}. (type string)`,
    );
  }

  if (!allowEmpty && !value.trim()) {
    throw new Error(`Argument ${argName} must not be empty or whitespace-only`);
  }

  return value;
}

export function getOptionalStringArg(
  args: any,
  argName: string,
  allowEmpty = false,
) {
  if (typeof args?.[argName] === "undefined") {
    return undefined;
  }
  return getStringArg(args, argName, allowEmpty);
}

export function getNumberArg(args: any, argName: string): number {
  if (!args || !(argName in args)) {
    throw new Error(`Argument \`${argName}\` is required (type number)`);
  }
  const value = args[argName];
  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new Error(`Argument \`${argName}\` must be a valid number`);
    }
    return parsed;
  }
  if (typeof value !== "number" || isNaN(value)) {
    throw new Error(`Argument \`${argName}\` must be a valid number`);
  }
  return Math.floor(value); // Ensure integer for line numbers (supports negative numbers)
}

export function getBooleanArg(args: any, argName: string, required = false) {
  if (!args || !(argName in args)) {
    if (required) {
      throw new Error(`Argument \`${argName}\` is required (type boolean)`);
    } else {
      return undefined;
    }
  }
  if (typeof args[argName] === "string") {
    if (args[argName].toLowerCase() === "false") {
      return false;
    }
    if (args[argName].toLowerCase() === "true") {
      return true;
    }
  }
  if (typeof args[argName] !== "boolean") {
    throw new Error(`Argument \`${argName}\` must be a boolean true or false`);
  }
  return args[argName];
}
