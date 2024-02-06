import { distance } from "fastest-levenshtein";
import { LineStream } from "../diff/util";

export async function* streamWithNewLines(stream: LineStream): LineStream {
  let firstLine = true;
  for await (const nextLine of stream) {
    if (!firstLine) {
      yield "\n";
    }
    firstLine = false;
    yield nextLine;
  }
}

const brackets = ["(", "[", "{", "`", '"""'];
const bracketsReverse = [")", "]", "}", "`", '"""'];

export async function* stopAtSimilarLine(
  stream: LineStream,
  line: string
): AsyncGenerator<string> {
  line = line.trim();
  for await (const nextLine of stream) {
    if (
      bracketsReverse.includes(nextLine.trim()) &&
      bracketsReverse.includes(line.trim()) &&
      line.trim() === nextLine.trim()
    ) {
      continue;
    }

    const dist = distance(nextLine.trim(), line);
    let lineQualifies = nextLine.length > 4 && line.length > 4;
    if (lineQualifies && dist / line.length < 0.1) {
      break;
    }
    yield nextLine;
  }
}
