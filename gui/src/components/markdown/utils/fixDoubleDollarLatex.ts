/*
Currently double dollar latext with new lines causes truncation error
*/
export function fixDoubleDollarNewLineLatex(text: string): string {
  // Match LaTeX blocks delimited by $$ with newlines
  const pattern = /\$\$(?:\r?\n)(.*?)(?:\r?\n)\$\$/gms;

  // Replace each matched block with $$ without newline
  const replacedText = text.replace(pattern, "$$$$$1$$$$");

  console.log("RESULT", replacedText);
  return replacedText;
}
