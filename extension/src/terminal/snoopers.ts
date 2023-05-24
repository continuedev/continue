export abstract class TerminalSnooper<T> {
  abstract onData(data: string): void;
  abstract onWrite(data: string): void;
  callback: (data: T) => void;

  constructor(callback: (data: T) => void) {
    this.callback = callback;
  }
}

function stripAnsi(data: string) {
  const pattern = [
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))",
  ].join("|");

  let regex = new RegExp(pattern, "g");
  return data.replace(regex, "");
}

export class CommandCaptureSnooper extends TerminalSnooper<string> {
  stdinBuffer = "";
  cursorPos = 0;
  stdoutHasInterrupted = false;

  static RETURN_KEY = "\r";
  static DEL_KEY = "\x7F";
  static UP_KEY = "\x1B[A";
  static DOWN_KEY = "\x1B[B";
  static RIGHT_KEY = "\x1B[C";
  static LEFT_KEY = "\x1B[D";
  static CONTROL_KEYS = new Set([
    CommandCaptureSnooper.RETURN_KEY,
    CommandCaptureSnooper.DEL_KEY,
    CommandCaptureSnooper.UP_KEY,
    CommandCaptureSnooper.DOWN_KEY,
    CommandCaptureSnooper.RIGHT_KEY,
    CommandCaptureSnooper.LEFT_KEY,
  ]);

  private _cursorLeft() {
    this.cursorPos = Math.max(0, this.cursorPos - 1);
  }
  private _cursorRight() {
    this.cursorPos = Math.min(this.stdinBuffer.length, this.cursorPos + 1);
  }
  // Known issue: This does not handle autocomplete.
  // Would be preferable to find a way that didn't require this all, just parsing by command prompt
  // but that has it's own challenges
  private handleControlKey(data: string): void {
    switch (data) {
      case CommandCaptureSnooper.DEL_KEY:
        this.stdinBuffer =
          this.stdinBuffer.slice(0, this.cursorPos - 1) +
          this.stdinBuffer.slice(this.cursorPos);
        this._cursorLeft();
        break;
      case CommandCaptureSnooper.RETURN_KEY:
        this.callback(this.stdinBuffer);
        this.stdinBuffer = "";
        break;
      case CommandCaptureSnooper.UP_KEY:
      case CommandCaptureSnooper.DOWN_KEY:
        this.stdinBuffer = "";
        break;
      case CommandCaptureSnooper.RIGHT_KEY:
        this._cursorRight();
        break;
      case CommandCaptureSnooper.LEFT_KEY:
        this._cursorLeft();
        break;
    }
  }

  onWrite(data: string): void {
    if (CommandCaptureSnooper.CONTROL_KEYS.has(data)) {
      this.handleControlKey(data);
    } else {
      this.stdinBuffer =
        this.stdinBuffer.substring(0, this.cursorPos) +
        data +
        this.stdinBuffer.substring(this.cursorPos);
      this._cursorRight();
    }
  }

  onData(data: string): void {}
}

export class PythonTracebackSnooper extends TerminalSnooper<string> {
  static tracebackStart = "Traceback (most recent call last):";
  tracebackBuffer = "";

  static tracebackEnd = (buf: string): string | undefined => {
    let lines = buf.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (
        lines[i].startsWith("  File") &&
        i + 2 < lines.length &&
        lines[i + 2][0] != " "
      ) {
        return lines.slice(0, i + 3).join("\n");
      }
    }
    return undefined;
  };
  override onWrite(data: string): void {}
  override onData(data: string): void {
    let strippedData = stripAnsi(data);
    // Strip fully blank and squiggle lines
    strippedData = strippedData
      .split("\n")
      .filter((line) => line.trim().length > 0 && line.trim() !== "~~^~~")
      .join("\n");
    // Snoop for traceback
    let idx = strippedData.indexOf(PythonTracebackSnooper.tracebackStart);
    if (idx >= 0) {
      this.tracebackBuffer = strippedData.substr(idx);
    } else if (this.tracebackBuffer.length > 0) {
      this.tracebackBuffer += "\n" + strippedData;
    }
    // End of traceback, send to webview
    if (this.tracebackBuffer.length > 0) {
      let wholeTraceback = PythonTracebackSnooper.tracebackEnd(
        this.tracebackBuffer
      );
      if (wholeTraceback) {
        this.callback(wholeTraceback);
        this.tracebackBuffer = "";
      }
    }
  }
}
