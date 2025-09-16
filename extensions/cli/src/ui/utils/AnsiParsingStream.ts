import { Writable } from "stream";

export interface StyleInfo {
  color: string | null;
  backgroundColor: string | null;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  dim: boolean;
  inverse: boolean;
}

export interface StyledSegment {
  text: string;
  startCol: number;
  endCol: number;
  style: StyleInfo;
}

export interface StyledLine {
  line: number;
  segments: StyledSegment[];
}

export class AnsiParsingStream extends Writable {
  segments: Array<{
    text: string;
    position: { row: number; col: number };
    endPosition: { row: number; col: number };
    style: StyleInfo;
  }> = [];

  currentPosition = { row: 0, col: 0 };
  currentStyle = this.getDefaultStyle();
  rawOutput = "";

  // TTY-like properties to make Ink think this is a terminal
  isTTY = false;
  columns = 80;
  rows = 24;

  constructor(options = {}) {
    super(options);
  }

  getDefaultStyle(): StyleInfo {
    return {
      color: null as string | null,
      backgroundColor: null as string | null,
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
      dim: false,
      inverse: false,
    };
  }

  _write(
    chunk: Buffer,
    _encoding: string,
    callback: (error?: Error | null) => void,
  ) {
    const data = chunk.toString();
    this.rawOutput += data;
    this.parseAnsiSequences(data);
    callback();
  }

  parseAnsiSequences(data: string) {
    const ansiRegex = /\x1b\[[0-9;]*[a-zA-Z]/g;
    let lastIndex = 0;
    let match;

    while ((match = ansiRegex.exec(data)) !== null) {
      if (match.index > lastIndex) {
        const text = data.slice(lastIndex, match.index);
        this.addTextSegment(text);
      }

      this.processEscapeSequence(match[0]);
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < data.length) {
      const text = data.slice(lastIndex);
      this.addTextSegment(text);
    }
  }

  addTextSegment(text: string) {
    if (!text) return;

    let currentText = "";
    let currentCol = this.currentPosition.col;
    let currentRow = this.currentPosition.row;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (char === "\n") {
        if (currentText.length > 0) {
          this.segments.push({
            text: currentText,
            position: { row: currentRow, col: currentCol },
            endPosition: {
              row: currentRow,
              col: currentCol + currentText.length - 1,
            },
            style: { ...this.currentStyle },
          });
          currentText = "";
        } else {
          // Create empty segment for blank lines
          this.segments.push({
            text: "",
            position: { row: currentRow, col: 0 },
            endPosition: { row: currentRow, col: 0 },
            style: { ...this.currentStyle },
          });
        }

        currentRow++;
        currentCol = 0;
      } else if (char === "\r") {
        if (currentText.length > 0) {
          this.segments.push({
            text: currentText,
            position: { row: currentRow, col: currentCol },
            endPosition: {
              row: currentRow,
              col: currentCol + currentText.length - 1,
            },
            style: { ...this.currentStyle },
          });
          currentText = "";
        }

        currentCol = 0;
      } else {
        currentText += char;
      }
    }

    if (currentText.length > 0) {
      this.segments.push({
        text: currentText,
        position: { row: currentRow, col: currentCol },
        endPosition: {
          row: currentRow,
          col: currentCol + currentText.length - 1,
        },
        style: { ...this.currentStyle },
      });
      currentCol += currentText.length;
    }

    this.currentPosition.row = currentRow;
    this.currentPosition.col = currentCol;
  }

  processEscapeSequence(sequence: string) {
    const code = sequence.slice(2, -1);
    const command = sequence.slice(-1);

    if (command === "m") {
      this.processSGR(code);
    }
  }

  processSGR(code: string) {
    const codes = code ? code.split(";").map(Number) : [0];

    for (let i = 0; i < codes.length; i++) {
      const num = codes[i];

      switch (num) {
        case 0:
          this.currentStyle = this.getDefaultStyle();
          break;
        case 1:
          this.currentStyle.bold = true;
          break;
        case 3:
          this.currentStyle.italic = true;
          break;
        case 4:
          this.currentStyle.underline = true;
          break;
        case 9:
          this.currentStyle.strikethrough = true;
          break;
        case 22:
          this.currentStyle.bold = false;
          this.currentStyle.dim = false;
          break;
        case 23:
          this.currentStyle.italic = false;
          break;
        case 24:
          this.currentStyle.underline = false;
          break;
        case 29:
          this.currentStyle.strikethrough = false;
          break;
        default:
          if (num >= 30 && num <= 37) {
            this.currentStyle.color = this.getColorName(num - 30);
          } else if (num >= 90 && num <= 97) {
            // Bright colors (90-97)
            this.currentStyle.color = this.getBrightColorName(num - 90);
          } else if (num >= 40 && num <= 47) {
            this.currentStyle.backgroundColor = this.getColorName(num - 40);
          } else if (num >= 100 && num <= 107) {
            // Bright background colors (100-107)
            this.currentStyle.backgroundColor = this.getBrightColorName(
              num - 100,
            );
          } else if (num === 38) {
            // Extended foreground color
            const colorInfo = this.parseExtendedColor(codes, i);
            if (colorInfo) {
              this.currentStyle.color = colorInfo.color;
              i = colorInfo.nextIndex;
            }
          } else if (num === 48) {
            // Extended background color
            const colorInfo = this.parseExtendedColor(codes, i);
            if (colorInfo) {
              this.currentStyle.backgroundColor = colorInfo.color;
              i = colorInfo.nextIndex;
            }
          } else if (num === 39) {
            this.currentStyle.color = null;
          } else if (num === 49) {
            this.currentStyle.backgroundColor = null;
          }
          break;
      }
    }
  }

  parseExtendedColor(codes: number[], currentIndex: number) {
    if (currentIndex + 1 >= codes.length) return null;

    const colorType = codes[currentIndex + 1];

    if (colorType === 5) {
      // 256-color mode
      if (currentIndex + 2 >= codes.length) return null;
      const colorIndex = codes[currentIndex + 2];
      return {
        color: `ansi256-${colorIndex}`,
        nextIndex: currentIndex + 2,
      };
    } else if (colorType === 2) {
      // RGB mode
      if (currentIndex + 4 >= codes.length) return null;
      const r = codes[currentIndex + 2];
      const g = codes[currentIndex + 3];
      const b = codes[currentIndex + 4];
      return {
        color: `rgb(${r},${g},${b})`,
        nextIndex: currentIndex + 4,
      };
    }

    return null;
  }

  getColorName(colorIndex: number): string {
    const colors = [
      "black",
      "red",
      "green",
      "yellow",
      "blue",
      "magenta",
      "cyan",
      "white",
    ];
    return colors[colorIndex] || `color-${colorIndex}`;
  }

  getBrightColorName(colorIndex: number): string {
    const brightColors = [
      "blackBright",
      "redBright",
      "greenBright",
      "yellowBright",
      "blueBright",
      "magentaBright",
      "cyanBright",
      "whiteBright",
    ];
    // For gray (bright black), use 'gray' which Ink recognizes
    if (colorIndex === 0) return "gray";
    return brightColors[colorIndex] || `brightColor-${colorIndex}`;
  }

  getFormattedLines(): StyledLine[] {
    const lines = new Map<number, typeof this.segments>();

    this.segments.forEach((segment) => {
      const row = segment.position.row;
      if (!lines.has(row)) {
        lines.set(row, []);
      }
      lines.get(row)!.push(segment);
    });

    lines.forEach((segments) => {
      segments.sort((a, b) => a.position.col - b.position.col);
    });

    const result: StyledLine[] = [];
    const sortedLines = Array.from(lines.entries()).sort(([a], [b]) => a - b);

    sortedLines.forEach(([lineNum, segments]) => {
      result.push({
        line: lineNum,
        segments: segments.map((segment) => ({
          text: segment.text,
          startCol: segment.position.col,
          endCol: segment.endPosition.col,
          style: segment.style,
        })),
      });
    });

    return result;
  }

  reset() {
    this.segments = [];
    this.currentPosition = { row: 0, col: 0 };
    this.currentStyle = this.getDefaultStyle();
    this.rawOutput = "";
  }
}
