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
      let buffer = "";
      visit(paragraphNode, "text", (textNode) => {
        buffer += textNode.value;
      });

      const tableRegex =
        /((?:\| *[^|\r\n]+ *)+\|)(?:\r?\n)((?:\|[ :]?-+[ :]?)+\|)((?:(?:\r?\n)(?:\| *[^|\r\n]+ *)+\|)+)/g;
      //// header                // newline // |:---|----:|      // new line  // table rows

      // prevent modifying if no markdown tables are present
      if (!buffer.match(tableRegex)) {
        return;
      }

      let match: RegExpExecArray | null;
      let lastIndex = 0;
      const newNodes = [];
      let failed = false;

      while ((match = tableRegex.exec(buffer)) !== null) {
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

          // Add any text before the table as a text node
          if (match.index > lastIndex) {
            newNodes.push({
              type: "text",
              value: buffer.slice(lastIndex, match.index),
            });
          }

          // Add table node
          newNodes.push(tableNode);
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

      // Add any remaining text after the last table
      if (lastIndex < buffer.length) {
        newNodes.push({
          type: "text",
          value: buffer.slice(lastIndex),
        });
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
