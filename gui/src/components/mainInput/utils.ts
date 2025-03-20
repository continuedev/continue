import { JSONContent } from "@tiptap/core";

export function getParagraphNodeFromString(str: string): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: str,
          },
        ],
      },
    ],
  };
}
