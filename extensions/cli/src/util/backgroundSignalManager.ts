import { EventEmitter } from "events";

// Event emitter to notify that running terminal command should be moved to background
class BackgroundSignalManager extends EventEmitter {
  signalBackground(): void {
    this.emit("backgroundRequested");
  }
}

export const backgroundSignalManager = new BackgroundSignalManager();
