import { EventEmitter } from "events";

export class BackgroundSignalManager extends EventEmitter {
  signalBackground(): void {
    this.emit("backgroundRequested");
  }
}

export const backgroundSignalManager = new BackgroundSignalManager();
