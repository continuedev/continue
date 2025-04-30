/**
 * This file provides a bridge between the Databricks LLM provider and the VS Code thinking panel.
 * It exposes a function to register the thinking panel and utilities to send thinking updates.
 */

// Conditional imports for VS Code API (only available in extension environment)
let vscode: any;
try {
  vscode = require('vscode');
} catch (e) {
  console.log("VS Code API not available, thinking panel features will be limited");
  // Create a mock version of vscode for environments without the real API
  vscode = {
    commands: {
      executeCommand: (command: string, ...args: any[]) => {
        console.log(`Mock executeCommand: ${command}`, args);
        return Promise.resolve();
      }
    }
  };
}

/**
 * Registers the thinking panel with the VS Code extension
 * This is called from the VS Code extension's activation function
 */
export function registerThinkingPanel(context: any) {
  // This function is implemented in the VS Code extension
  if (vscode && vscode.commands) {
    try {
      vscode.commands.executeCommand('continue.registerThinkingPanel', context);
      console.log("Registered thinking panel with VS Code extension");
    } catch (e) {
      console.warn("Failed to register thinking panel:", e);
    }
  } else {
    console.log("VS Code API not available, thinking panel not registered");
  }
}

/**
 * Updates the thinking panel with new thinking content
 * @param content The thinking content to display
 * @param phase The current phase of thinking (e.g., "analyzing", "planning")
 * @param progress The progress value between 0 and 1
 */
export function updateThinking(content: string, phase: string, progress: number) {
  if (vscode && vscode.commands) {
    try {
      vscode.commands.executeCommand('continue.updateThinking', content, phase, progress);
    } catch (e) {
      console.warn("Failed to update thinking panel:", e);
    }
  }
}

/**
 * Notifies the thinking panel that thinking has completed
 */
export function thinkingCompleted() {
  if (vscode && vscode.commands) {
    try {
      vscode.commands.executeCommand('continue.thinkingCompleted');
    } catch (e) {
      console.warn("Failed to signal thinking completion:", e);
    }
  }
}