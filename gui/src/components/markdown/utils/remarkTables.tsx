// import { visit } from "unist-util-visit";

// // const markdownTableRegex = /(\|.+?\|)(\n\|(?:[-:]+?\|)+)(\n\|.+?\|)+/gm;
// const tableRegex = /(\|(?:[^\|]*\|)+(\s*\n\s*\|(?:[^\|]*\|)+)*\s*(\n|\r|\r\n)?\|(?:[-:\s]*\|)+(\s*\n\s*\|(?:[^\|]*\|)+)*)/g;

// const parseMarkdownTable = (markdown) => {
//   const rows = markdown.trim().split("\n");
//   const header = rows[0]
//     .split("|")
//     .slice(1, -1)
//     .map((cell) => cell.trim());
//   const alignments = rows[1]
//     .split("|")
//     .slice(1, -1)
//     .map((cell) => {
//       if (cell.startsWith(":") && cell.endsWith(":")) return "center";
//       if (cell.startsWith(":")) return "left";
//       if (cell.endsWith(":")) return "right";
//       return null;
//     });
//   const bodyRows = rows.slice(2).map((row) =>
//     row
//       .split("|")
//       .slice(1, -1)
//       .map((cell) => cell.trim()),
//   );

//   return { header, alignments, bodyRows };
// };

// const renderTable = ({ header, alignments, bodyRows }) => (
//   <table>
//     <thead>
//       <tr>
//         {header.map((cell, index) => (
//           <th key={index} style={{ textAlign: alignments[index] || "left" }}>
//             {cell}
//           </th>
//         ))}
//       </tr>
//     </thead>
//     <tbody>
//       {bodyRows.map((row, rowIndex) => (
//         <tr key={rowIndex}>
//           {row.map((cell, cellIndex) => (
//             <td
//               key={cellIndex}
//               style={{ textAlign: alignments[cellIndex] || "left" }}
//             >
//               {cell}
//             </td>
//           ))}
//         </tr>
//       ))}
//     </tbody>
//   </table>
// );

// export function remarkTables() {
//   return (tree) => {
//     visit(tree, "text", (node, index, parent) => {
//       if (!node.value) return;

//       const matches = [...node.value.matchAll(markdownTableRegex)];
//       console.log("MATCHES", matches);
//       if (matches.length === 0) return;

//       const fragments = [];
//       let lastIndex = 0;

//       matches.forEach((match, idx) => {
//         const [fullMatch] = match;
//         const matchStart = match.index;
//         const matchEnd = matchStart + fullMatch.length;

//         // Add text before the table
//         if (matchStart > lastIndex) {
//           fragments.push(node.value.slice(lastIndex, matchStart));
//         }

//         // Parse and render the markdown table
//         const table = parseMarkdownTable(fullMatch);
//         fragments.push(renderTable(table));

//         lastIndex = matchEnd;
//       });

//       // Add remaining text after the last table
//       if (lastIndex < node.value.length) {
//         fragments.push(node.value.slice(lastIndex));
//       }

//       // Replace the parent node with a fragment containing the new nodes
//       if (parent && parent.children) {
//         parent.children.splice(index, 1, ...fragments);
//       }
//     });
//   };
// }

const visit = require("unist-util-visit");

export function remarkTables() {
  return (tree) => {
    visit(tree, "text", (node, index, parent) => {
      const { value } = node;
      // Inspired by
      // https://stackoverflow.com/questions/9837935/regex-for-markdown-table-syntax
      const tableRegex =
        /^(\|[^\n]+\|(?:\r?\n| ))((?:\|:?[-]+:?)+\|)((?:\r?\n| )(?:\|[^\n]+\|(?:\r?\n| ))*)?$/gm;
      let match;
      let lastIndex = 0;
      const newNodes = [];

      while ((match = tableRegex.exec(value)) !== null) {
        console.log(match);
        const tableText = match[0];

        // Add any text before the table as a text node
        if (match.index > lastIndex) {
          newNodes.push({
            type: "text",
            value: value.slice(lastIndex, match.index),
          });
        }

        const tableNode = parseTable(tableText);
        if (tableNode) {
          newNodes.push(tableNode);
        } else {
          // If parsing failed, keep the original text
          newNodes.push({
            type: "text",
            value: tableText,
          });
        }

        lastIndex = tableRegex.lastIndex;
      }

      // Add any remaining text after the last table
      if (lastIndex < value.length) {
        newNodes.push({
          type: "text",
          value: value.slice(lastIndex),
        });
      }

      // Replace the original text node with the new nodes
      if (newNodes.length > 0) {
        parent.children.splice(index, 1, ...newNodes);
      }
    });
  };
}

// The parseTable function remains the same as before
function parseTable(tableText) {
  const lines = tableText.trim().split(/\r?\n/);

  if (lines.length < 2) return null; // Not enough lines for a valid table

  const header = splitRow(lines[0]);
  const separator = splitRow(lines[1]);

  // Validate the separator line
  if (!separator.every((cell) => /^:?-+:?$/.test(cell.trim()))) {
    return null;
  }

  const alignments = separator.map((cell) => {
    const trimmed = cell.trim();
    if (trimmed.startsWith(":") && trimmed.endsWith(":")) return "center";
    if (trimmed.endsWith(":")) return "right";
    if (trimmed.startsWith(":")) return "left";
    return null;
  });

  const tableNode = {
    type: "element",
    tagName: "table",
    children: [
      {
        type: "element",
        tagName: "thead",
        children: [
          {
            type: "element",
            tagName: "tr",
            children: header.map((cell, i) => ({
              type: "element",
              tagName: "th",
              properties: {
                align: alignments[i] || "left",
                className: "text-" + alignments[i],
              },
              children: [{ type: "text", value: cell.trim() }],
            })),
          },
        ],
      },
      {
        type: "element",
        tagName: "tbody",
        children: lines.slice(2).map((line) => {
          const cells = splitRow(line);
          return {
            type: "element",
            tagName: "tr",
            children: cells.map((cell, i) => ({
              type: "element",
              tagName: "td",
              properties: {
                align: alignments[i] || "left",
                className: "text-" + alignments[i],
              },
              children: [{ type: "text", value: cell.trim() }],
            })),
          };
        }),
      },
    ],
  };

  return tableNode;
}

function splitRow(row) {
  return row
    .trim()
    .replace(/^\||\|$/g, "") // Remove leading and trailing pipes
    .split("|");
}
