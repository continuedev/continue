import { Todos } from "core";

function tryParseJson(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function stripFences(text: string): string {
  // Remove triple-backtick fences and surrounding markdown if present
  return text
    .replace(/```(?:json)?\n([\s\S]*?)```/g, (_, inner) => inner)
    .trim();
}

// Attempt to find a JSON object substring that contains a "todos" key
function findJsonWithTodos(text: string): any | null {
  // First try the whole text (after stripping fences)
  const stripped = stripFences(text);
  let parsed = tryParseJson(stripped);
  if (parsed && typeof parsed === "object" && (parsed.todos || parsed.items)) {
    return parsed;
  }

  // Try to locate the first {...} that contains "todos"
  const objectRegex = /\{[\s\S]*?\}/g;
  let match: RegExpExecArray | null;
  while ((match = objectRegex.exec(text))) {
    parsed = tryParseJson(match[0]);
    if (
      parsed &&
      typeof parsed === "object" &&
      (parsed.todos || parsed.items)
    ) {
      return parsed;
    }
  }

  return null;
}

function cleanJsonStringPreserveStructure(str: string): string {
  if (!str || typeof str !== "string") {
    throw new Error("Input must be a non-empty string");
  }

  return (
    str
      .trim()
      // Only replace escaped newlines with spaces (don't affect actual newlines)
      .replace(/\\n/g, " ")
      .replace(/\\t/g, " ")
      .replace(/\\r/g, " ")
  );
}

export function parseTodosFromText(
  content: string | undefined | null,
): Todos | null {
  if (!content) return null;

  // If content is already JSON-like string, attempt parsing
  const cleanString = cleanJsonStringPreserveStructure(content);
  let parsed = findJsonWithTodos(cleanString);

  if (!parsed) {
    // As a last resort, try to extract a JSON array labeled todos: [ ... ] pattern
    const todosArrayRegex = /(todos|items)\s*:\s*(\[[\s\S]*?\])/i;
    const m = todosArrayRegex.exec(cleanString);
    if (m) {
      parsed = tryParseJson(m[2]);
      if (parsed && !Array.isArray(parsed)) parsed = null;
      else if (Array.isArray(parsed)) parsed = { todos: parsed } as any;
    }
  }

  const parsedTodos = Array.isArray(parsed?.todos)
    ? parsed.todos
    : Array.isArray(parsed?.items)
      ? parsed.items
      : null;

  if (!parsed || !parsedTodos) return null;

  const todos = parsedTodos.map((t: any, i: number) => {
    if (typeof t === "string") {
      return { text: t, order: i + 1, completed: false };
    }
    return {
      text: t?.text ?? String(t ?? ""),
      order: typeof t?.order === "number" ? t.order : i + 1,
      id: typeof t?.id === "number" ? t.id : undefined,
      completed: typeof t?.completed === "boolean" ? t.completed : false,
    };
  });

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    todos,
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
  };
}

export default parseTodosFromText;
