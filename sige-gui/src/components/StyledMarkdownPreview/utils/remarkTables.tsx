import { visit } from "unist-util-visit";

/*
  Remark plugin for github-flavor markdown tables
  Given a table such as this exists in a text node:

  | Fruit    | Color   | Taste       |
  |----------|---------|-------------|
  | Apple    | Red     | Sweet       |
  | Banana   | Yellow  | Sweet       |
  | Lemon    | Yellow  | Sour        |
  | Orange   | Orange  | Citrus      |
  | Grape    | Purple  | Sweet/Tart  |

  1. Find it and split it into groups using regex
      - header
      - alignment row
      - body
  2. Parse the groups to get table cell values and text alignment
  3. Build an MDAST table node
  4. Do this for each table found, until no tables are found
*/
export function remarkTables() {
  return (tree: any) => {
    visit(tree, "paragraph", (paragraphNode, index, parentOfParagraphNode) => {
      // Collect all child nodes into a buffer, preserving their types
      const buffer: any[] = [];
      paragraphNode.children.forEach((child: any) => {
        buffer.push(child);
      });

      // Flatten buffer to a string for regex matching, but keep track of positions
      let bufferString = "";
      const positions: { start: number; end: number; node: any }[] = [];

      // Recursive renderer for inline nodes -> markdown-ish text
      function renderInline(node: any): string {
        if (!node) return "";
        if (Array.isArray(node.children)) {
          return node.children.map(renderInline).join("");
        }
        if (typeof node.value === "string") {
          return node.value;
        }
        return "";
      }

      buffer.forEach((item) => {
        const start = bufferString.length;
        // renderInline returns a markdown-like string for inline nodes so decorations are preserved
        const rendered = renderInline(item);
        bufferString += rendered;
        positions.push({ start, end: bufferString.length, node: item });
      });

      const tableRegex =
        /((?:\| *[^|\r\n]+ *)+\|)(?:\r?\n)((?:\|[ :]?-+[ :]?)+\|)((?:(?:\r?\n)(?:\| *[^|\r\n]+ *)+\|)+)/g;
      //// header                // newline // |:---|----:|      // new line  // table rows

      // prevent modifying if no markdown tables are present
      if (!bufferString.match(tableRegex)) {
        return;
      }

      let match: RegExpExecArray | null;
      let lastIndex = 0;
      const newNodes = [];
      let failed = false;

      while ((match = tableRegex.exec(bufferString)) !== null) {
        const fullTableString = match[0];
        const headerGroup = match[1];
        const separatorGroup = match[2];
        const bodyGroup = match[3];

        if (!fullTableString || !headerGroup || !separatorGroup || !bodyGroup) {
          console.error("Markdown table regex failed to yield table groups");
          failed = true;
          break;
        }

        const headerCells = splitRow(headerGroup);
        const alignments = splitRow(separatorGroup).map((cell) => {
          if (cell.startsWith(":") && cell.endsWith(":")) return "center";
          if (cell.endsWith(":")) return "right";
          if (cell.startsWith(":")) return "left";
          return null;
        });

        const bodyCells = bodyGroup
          .trim()
          .split("\n")
          .map((bodyRow) => splitRow(bodyRow));

        try {
          const tableNode = {
            type: "table",
            align: alignments,
            data: {
              hProperties: {
                class: "markdown-table",
              },
            },
            children: [
              {
                type: "tableRow",
                children: headerCells.map((cell, i) => ({
                  type: "element",
                  tagName: "th",
                  align: alignments[i],
                  children: [{ type: "text", value: cell }],
                })),
              },
              ...bodyCells.map((row, i) => {
                return {
                  type: "tableRow",
                  data: {
                    hProperties: {
                      key: i,
                    },
                  },
                  children: row.map((cell, i) => ({
                    type: "tableCell",
                    align: alignments[i],
                    children: [{ type: "text", value: cell.trim() }],
                  })),
                };
              }),
            ],
          };

          // Add any nodes before/after the table in one go
          const tableStart = match.index;
          const tableEnd = match.index + fullTableString.length;

          // Process the text within the table and the surrounding text together
          const beforeNodes: any[] = [];
          const afterNodes: any[] = [];

          positions.forEach((pos) => {
            if (pos.end <= tableStart) {
              beforeNodes.push(pos.node);
            } else if (pos.start >= tableEnd) {
              afterNodes.push(pos.node);
            } else if (pos.node.type === "text") {
              // Node is text and overlaps with table, may need splitting
              const beforeText = pos.node.value.slice(
                0,
                Math.max(0, tableStart - pos.start),
              );
              const afterText = pos.node.value.slice(
                Math.max(0, tableEnd - pos.start),
              );
              if (beforeText)
                beforeNodes.push({ type: "text", value: beforeText });
              if (afterText)
                afterNodes.push({ type: "text", value: afterText });
            } else {
              // Node overlaps with table but isn't text (e.g., inlineCode, emphasis, etc.)
              if (pos.start < tableStart) beforeNodes.push(pos.node);
              if (pos.end > tableEnd) afterNodes.push(pos.node);
            }
          });

          // Add to new nodes
          newNodes.push(...beforeNodes);
          newNodes.push(tableNode);
          newNodes.push(...afterNodes);

          // Mark positions as consumed
          positions.length = 0;
        } catch (e) {
          console.error("Failed to parse markdown table after regex match", e);
          newNodes.push({
            type: "text",
            value: fullTableString,
          });
        }

        lastIndex = tableRegex.lastIndex;
      }

      if (failed) {
        return;
      }

      // Replace the original paragraph node with the new nodes
      if (newNodes.length > 0) {
        parentOfParagraphNode.children.splice(index, 1, ...newNodes);
      }
    });
  };
}

function splitRow(row: string) {
  return row
    .trim()
    .replace(/^\||\|$/g, "") // Remove leading and trailing pipes
    .split("|")
    .map((cell) => cell.trim());
}
