import { stripVTControlCharacters } from "node:util";

import chalk from "chalk";

import { getVersion } from "./version.js";

/**
 * The loop from the Continuous mark (brand-src/mark.svg), six rows tall to
 * sit beside the wordmark. "@" cells are the dot travelling along it.
 */
const LOOP = [
  " ▄████▄       ▄█@@█▄ ",
  "██▀  ▀██▄   ▄██▀  ▀██",
  "██      ▀█▄█▀      ██",
  "██      ▄█▀█▄      ██",
  "██▄  ▄██▀   ▀██▄  ▄██",
  " ▀████▀       ▀████▀ ",
];

/** ANSI Shadow letters, six rows each. */
const GLYPHS: Record<string, string[]> = {
  C: [" ██████╗", "██╔════╝", "██║     ", "██║     ", "╚██████╗", " ╚═════╝"],
  O: [
    " ██████╗ ",
    "██╔═══██╗",
    "██║   ██║",
    "██║   ██║",
    "╚██████╔╝",
    " ╚═════╝ ",
  ],
  N: [
    "███╗   ██╗",
    "████╗  ██║",
    "██╔██╗ ██║",
    "██║╚██╗██║",
    "██║ ╚████║",
    "╚═╝  ╚═══╝",
  ],
  T: [
    "████████╗",
    "╚══██╔══╝",
    "   ██║   ",
    "   ██║   ",
    "   ██║   ",
    "   ╚═╝   ",
  ],
  I: ["██╗", "██║", "██║", "██║", "██║", "╚═╝"],
  U: [
    "██╗   ██╗",
    "██║   ██║",
    "██║   ██║",
    "██║   ██║",
    "╚██████╔╝",
    " ╚═════╝ ",
  ],
  S: ["███████╗", "██╔════╝", "███████╗", "╚════██║", "███████║", "╚══════╝"],
};

const WORD = Array.from({ length: 6 }, (_, row) =>
  [..."CONTINUOUS"].map((letter) => GLYPHS[letter][row]).join(""),
);

type Rgb = [number, number, number];

/** The wordmark: cyan into the mark's indigo and on to violet. */
const WORD_GRADIENT: Rgb[] = [
  [0xa5, 0xf3, 0xfc],
  [0x81, 0x8c, 0xf8],
  [0x63, 0x66, 0xf1],
  [0xa7, 0x8b, 0xfa],
];
/** The loop: the mark's indigo, so the cyan dot stands out on it. */
const LOOP_GRADIENT: Rgb[] = [
  [0x63, 0x66, 0xf1],
  [0x81, 0x8c, 0xf8],
  [0xa7, 0x8b, 0xfa],
];
/** Made when drawn, not at import, so modules that only import this stay cheap. */
const dot = (s: string) => chalk.hex("#67E8F9").bold(s);

function colourAt(stops: Rgb[], t: number): string {
  const scaled = Math.min(Math.max(t, 0), 1) * (stops.length - 1);
  const i = Math.min(Math.floor(scaled), stops.length - 2);
  const f = scaled - i;
  const [a, b] = [stops[i], stops[i + 1]];
  const mix = (k: number) => Math.round(a[k] + (b[k] - a[k]) * f);
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hex(mix(0))}${hex(mix(1))}${hex(mix(2))}`;
}

/** A gradient across the block, left to right; "@" is the dot. */
function paint(rows: string[], stops: Rgb[] = WORD_GRADIENT): string[] {
  const width = Math.max(...rows.map((r) => [...r].length));
  return rows.map((row) =>
    [...row]
      .map((ch, col) => {
        if (ch === " ") return ch;
        if (ch === "@") return dot("█");
        return chalk.hex(colourAt(stops, col / Math.max(width - 1, 1)))(ch);
      })
      .join(""),
  );
}

const GAP = "   ";
const version = () => "v" + getVersion();
const dim = chalk.dim;

/** Loop and wordmark side by side, the version under the wordmark's end. */
function full(): string {
  const loop = paint(LOOP, LOOP_GRADIENT);
  const word = paint(WORD);
  const width = [...LOOP[0]].length + GAP.length + [...WORD[0]].length;
  const v = version();
  return [
    "",
    ...loop.map((l, i) => l + GAP + word[i]),
    " ".repeat(width - v.length) + dim(v),
  ].join("\n");
}

function wordOnly(): string {
  const width = [...WORD[0]].length;
  const v = version();
  return ["", ...paint(WORD), " ".repeat(width - v.length) + dim(v)].join("\n");
}

/** The loop with the name and version beside it. */
function compact(): string {
  const loop = paint(LOOP, LOOP_GRADIENT);
  const name = paint(["continuous"])[0];
  loop[2] += "  " + chalk.bold(name);
  loop[3] += "  " + dim(version());
  return ["", ...loop].join("\n");
}

function tiny(): string {
  return "\n" + chalk.bold(paint(["continuous"])[0]) + " " + dim(version());
}

/** Visible width of a banner: its longest line without colour codes. */
export function bannerWidth(banner: string): number {
  return Math.max(
    ...stripVTControlCharacters(banner)
      .split("\n")
      .map((line) => [...line].length),
  );
}

/**
 * The startup banner that fits the terminal. The intro box pads one column
 * each side, so a banner needs its width plus two.
 */
export function getDisplayableAsciiArt(
  columns: number = process.stdout.columns || 80,
): string {
  for (const make of [full, wordOnly, compact]) {
    const banner = make();
    if (bannerWidth(banner) + 2 <= columns) return banner;
  }
  return tiny();
}
