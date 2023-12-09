export function removeQuotesAndEscapes(output: string): string {
  output = output.trim();

  // Replace smart quotes
  output = output.replace("“", '"');
  output = output.replace("”", '"');
  output = output.replace("‘", "'");
  output = output.replace("’", "'");

  // Remove escapes
  output = output.replace('\\"', '"');
  output = output.replace("\\'", "'");
  output = output.replace("\\n", "\n");
  output = output.replace("\\t", "\t");
  output = output.replace("\\\\", "\\");
  if (
    (output.startsWith('"') && output.endsWith('"')) ||
    (output.startsWith("'") && output.endsWith("'"))
  ) {
    output = output.slice(1, -1);
  }

  return output;
}
