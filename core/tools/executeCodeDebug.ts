const DEBUG_FLAG =
  process.env.CONTINUE_DEBUG_EXECUTE_CODE === "true" ||
  process.env.CONTINUE_DEBUG_TOOLS === "true";

type Debuggable = Record<string, unknown>;

const SENSITIVE_KEYWORDS = ["apikey", "token", "secret"];

function sanitize(value: unknown, key?: string): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "object") {
    if (Array.isArray(value)) {
      return value.map((item) => sanitize(item));
    }

    return Object.entries(value).reduce<Debuggable>(
      (acc, [childKey, child]) => {
        const shouldRedact = SENSITIVE_KEYWORDS.some((keyword) =>
          childKey.toLowerCase().includes(keyword),
        );
        acc[childKey] = shouldRedact
          ? child
            ? "__redacted__"
            : child
          : sanitize(child, childKey);
        return acc;
      },
      {},
    );
  }

  if (
    key &&
    SENSITIVE_KEYWORDS.some((keyword) => key.toLowerCase().includes(keyword))
  ) {
    return value ? "__redacted__" : value;
  }

  return value;
}

export function logExecuteCodeDebug(
  message: string,
  context?: Debuggable,
): void {
  if (!DEBUG_FLAG) {
    return;
  }

  const sanitized = context ? sanitize(context) : undefined;
  const suffix = sanitized ? ` | ${JSON.stringify(sanitized)}` : "";
  console.debug(`[execute_code debug] ${message}${suffix}`);
}
