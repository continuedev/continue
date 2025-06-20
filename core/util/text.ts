export const capitalizeFirstLetter = (val: string) => {
  if (val.length === 0) {
    return "";
  }
  return val[0].toUpperCase() + val.slice(1);
};

export function replaceEscapedCharacters(str: string): string {
  return str.replaceAll(/\\(n|t|r|\\|"|')/g, (match, p1) => {
    switch (p1) {
      case "n":
        return "\n";
      case "t":
        return "\t";
      case "r":
        return "\r";
      case "\\":
        return "\\";
      case '"':
        return '"';
      case "'":
        return "'";
      default:
        return match; // NOTE: Handle unexpected escapes better than this.
    }
  });
}

export function escapeForSVG(text: string): string {
  return text
    .replace(/&/g, "&amp;") // must be first
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function kebabOfStr(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2") // handle camelCase and PascalCase
    .replace(/[\s_]+/g, "-") // replace spaces and underscores with hyphens
    .toLowerCase();
}
