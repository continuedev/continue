// Implementation for reading markdown todo list from global state. Returns the
// current markdown content with legend: [ ] planned, [x] done, [*] in progress,
// [~] cancelled.
import { ToolImpl } from ".";
import { getTodoMarkdown, countTodos, getTodoSummary } from "./todoState";

export const todoReadImpl: ToolImpl = async (_args, _extras) => {
  const markdown = getTodoMarkdown();

  if (!markdown) {
    const defaultContent = `# Todo List

<!-- 
Legend:
- [ ] planned
- [x] done  
- [*] in progress
- [~] cancelled
-->

## Tasks
`;

    return [
      {
        name: "Todo List (empty)",
        description: "Current todo list",
        content: defaultContent,
      },
    ];
  }

  // Count todos for summary
  const counts = countTodos(markdown);
  const summary = getTodoSummary(counts);

  return [
    {
      name: `Todo List (${summary})`,
      description: "Current todo list",
      content: markdown,
    },
  ];
};
