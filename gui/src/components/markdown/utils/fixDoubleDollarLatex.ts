/*
Currently double dollar latext with new lines causes truncation error
So this pseudo-remark plugin removes internal newlines with double dollar signs
*/
export function fixDoubleDollarNewLineLatex(text: string): string {
  // Match LaTeX blocks delimited by $$ with newlines
  const pattern = /\$\$(?:\r?\n)(.*?)(?:\r?\n)\$\$/gms;

  // Replace each matched block with $$ without newline
  const replacedText = text.replace(pattern, "$$$$$1$$$$");

  return replacedText;
}
