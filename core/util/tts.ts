import os from "node:os";
import { exec, ChildProcess } from "child_process";
import type { IMessenger } from "./messenger";
import type { FromCoreProtocol, ToCoreProtocol } from "../protocol";

// The amount of time before a process is declared
// a zombie after executing .kill()
const ttsKillTimeout: number = 5000;

/**
 * Removes code blocks from a message.
 *
 * Return modified message text.
 */
function removeCodeBlocks(msgText: string): string {
  const codeBlockRegex = /```[\s\S]*?```/g;

  // Remove code blocks from the message text
  const textWithoutCodeBlocks = msgText.replace(codeBlockRegex, "");

  return textWithoutCodeBlocks.trim();
}

/**
 * Cleans a message text to safely be used in 'exec' context on host.
 *
 * Return modified message text.
 */
function sanitizeMessageForTTS(message: string): string {
  message = removeCodeBlocks(message);

  // Remove or replace problematic characters
  message = message
    .replace(/"/g, "")
    .replace(/`/g, "")
    .replace(/\$/g, "")
    .replace(/\\/g, "")
    .replace(/[&|;()<>]/g, "");

  message = message.trim().replace(/\s+/g, " ");

  return message;
}

export class TTS {
  static os: string | undefined = undefined;
  static handle: ChildProcess | undefined = undefined;
  static messenger: IMessenger<ToCoreProtocol, FromCoreProtocol>;

  static async read(message: string) {
    message = sanitizeMessageForTTS(message);

    try {
      // Kill any active TTS processes
      await TTS.kill();
    } catch (e) {
      console.warn("Error killing TTS process: ", e);
      return;
    }

    switch (TTS.os) {
      case "darwin":
        TTS.handle = exec(`say "${message}"`);
        break;
      case "win32":
        // Replace single quotes on windows
        TTS.handle = exec(
          `powershell -Command "Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('${message.replace(
            /'/g,
            "''",
          )}')"`,
        );
        break;
      case "linux":
        TTS.handle = exec(`espeak "${message}"`);
        break;
      default:
        console.log(
          "Text-to-speech is not supported on this operating system.",
        );
        return;
    }

    TTS.messenger.request("setTTSActive", true);

    TTS.handle?.once("exit", () => {
      TTS.messenger.request("setTTSActive", false);
    });
  }

  static async kill(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Only kill a TTS process if it's still running
      if (TTS.handle && TTS.handle.exitCode === null) {
        // Use a timeout in case of zombie processes
        let killTimeout: NodeJS.Timeout = setTimeout(() => {
          reject(`Unable to kill TTS process: ${TTS.handle?.pid}`);
        }, ttsKillTimeout);

        // Resolve our promise once the program has exited
        TTS.handle.once("exit", () => {
          clearTimeout(killTimeout);
          TTS.handle = undefined;
          resolve();
        });

        TTS.handle.kill();
      } else {
        resolve();
      }
    });
  }

  static async setup() {
    TTS.os = os.platform();
  }
}
