// Implementation for writing markdown todo list to global state. Accepts the
// full markdown content and stores it in history. Format: [ ] planned, [x]
// done, [*] in progress, [~] cancelled.
import { ToolImpl } from ".";
import { setTodoMarkdown, countTodos, getTodoSummary } from "./todoState";

export const todoWriteImpl: ToolImpl = async (args, _extras) => {
  const markdown: string = args.markdown || "";

  // Store the markdown content
  setTodoMarkdown(markdown);

  // Count todos for summary
  const counts = countTodos(markdown);
  const summary = getTodoSummary(counts);

  return [
    {
      name: `Todo List Updated (${summary})`,
      description: "Todo list has been updated",
      content: markdown,
    },
  ];
};
