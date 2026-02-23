export function parseHexColor(hexColor: string): {
  r: number;
  g: number;
  b: number;
} {
  if (hexColor.startsWith("#")) {
    hexColor = hexColor.slice(1);
  }

  if (hexColor.length > 6) {
    hexColor = hexColor.slice(0, 6);
  }

  const r = parseInt(hexColor.substring(0, 2), 16);
  const g = parseInt(hexColor.substring(2, 4), 16);
  const b = parseInt(hexColor.substring(4, 6), 16);

  return { r, g, b };
}

export function parseColorForHex(colorVar: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(
    colorVar,
  );
  if (value.startsWith("#")) {
    return value.slice(0, 7);
  }

  // Parse rgb/rgba
  const rgbValues = value
    .slice(value.startsWith("rgba") ? 5 : 4, -1)
    .split(",")
    .map((x) => x.trim())
    .filter((_, i) => i < 3) // Only take the first 3 values (RGB, ignore alpha)
    .map((x) => parseInt(x, 10));

  let hex =
    "#" +
    rgbValues
      .map((x) => x.toString(16))
      .map((x) => (x.length === 1 ? "0" + x : x))
      .join("");

  return hex;
}
