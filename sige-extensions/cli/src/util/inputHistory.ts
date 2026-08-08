import fs from "fs";
import path from "path";

import { env } from "../env.js";

const HISTORY_FILE = path.join(env.continueHome, "input_history.json");
const MAX_HISTORY_SIZE = 1000;

export interface InputHistoryEntry {
  text: string;
  timestamp: number;
}

export class InputHistory {
  private history: InputHistoryEntry[] = [];
  private currentIndex: number = -1;
  private originalInput: string = "";

  constructor() {
    this.loadHistory();
  }

  private loadHistory(): void {
    try {
      const dir = path.dirname(HISTORY_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(HISTORY_FILE)) {
        const data = fs.readFileSync(HISTORY_FILE, "utf8");
        this.history = JSON.parse(data);
      }
    } catch (error) {
      console.error("Failed to load input history:", error);
      this.history = [];
    }
  }

  private saveHistory(): void {
    try {
      const dir = path.dirname(HISTORY_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(HISTORY_FILE, JSON.stringify(this.history, null, 2));
    } catch (error) {
      console.error("Failed to save input history:", error);
    }
  }

  addEntry(text: string): void {
    if (!text.trim()) return;

    // Remove duplicate if it exists
    this.history = this.history.filter((entry) => entry.text !== text);

    // Add new entry at the beginning
    this.history.unshift({
      text,
      timestamp: Date.now(),
    });

    // Limit history size
    if (this.history.length > MAX_HISTORY_SIZE) {
      this.history = this.history.slice(0, MAX_HISTORY_SIZE);
    }

    this.saveHistory();
    this.resetNavigation();
  }

  navigateUp(currentInput: string): string | null {
    if (this.history.length === 0) return null;

    // Store original input on first navigation
    if (this.currentIndex === -1) {
      this.originalInput = currentInput;
      this.currentIndex = 0;
    } else if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
    }

    return this.history[this.currentIndex]?.text || null;
  }

  navigateDown(): string | null {
    if (this.currentIndex === -1) return null;

    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.history[this.currentIndex]?.text || null;
    } else {
      // Return to original input
      const originalInput = this.originalInput;
      this.resetNavigation();
      return originalInput;
    }
  }

  resetNavigation(): void {
    this.currentIndex = -1;
    this.originalInput = "";
  }

  getHistory(): InputHistoryEntry[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
    this.resetNavigation();
    this.saveHistory();
  }
}
