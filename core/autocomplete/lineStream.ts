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

export async function* stopAtSimilarLine(
  stream: LineStream,
  line: string
): AsyncGenerator<string> {
  line = line.trim();
  for await (const nextLine of stream) {
    const dist = distance(nextLine.trim(), line);
    if (nextLine.length > 4 && line.length > 4 && dist / line.length < 0.1) {
      break;
    }
    yield nextLine;
  }
}
