import type { ChatHistoryItem, ToolStatus } from "core/index.js";
import { createHistoryItem } from "core/util/messageConversion.js";

import { updateSessionHistory, loadSessionById, createSession } from "../session.js";
import { logger } from "../util/logger.js";

import { BaseService } from "./BaseService.js";

/**
 * State managed by the ChatHistoryService
 */
export interface ChatHistoryState {
  history: ChatHistoryItem[];
  compactionIndex: number | null;
  sessionId: string;
  isRemoteMode: boolean;
}

/**
 * Service for managing chat history as the single source of truth
 * Provides immutable updates and automatic React integration via events
 */
export class ChatHistoryService extends BaseService<ChatHistoryState> {
  // Simple undo/redo stacks for history snapshots
  private past: ChatHistoryItem[][] = [];
  private future: ChatHistoryItem[][] = [];

  constructor() {
    super("ChatHistoryService", {
      history: [],
      compactionIndex: null,
      sessionId: "",
      isRemoteMode: false,
    });
    this.setMaxListeners(50);
  }

  private setHistoryInternal(
    history: ChatHistoryItem[],
    options: { recordUndo?: boolean } = {},
  ): void {
    const { recordUndo = true } = options;
    const prev = this.currentState.history;
    if (recordUndo) {
      this.past.push([...prev]);
      this.future = [];
    }
    this.setState({
      history: [...history],
      compactionIndex: this.findCompactionIndex(history),
    });

    if (!this.currentState.isRemoteMode) {
      updateSessionHistory(history);
    }
  }

  /**
   * Initialize the service with optional session
   */
  async doInitialize(session?: any, isRemoteMode = false): Promise<ChatHistoryState> {
    const activeSession = session || createSession([]);
    
    logger.debug("Initializing ChatHistoryService", {
      sessionId: activeSession.sessionId,
      historyLength: activeSession.history.length,
      isRemoteMode,
    });

    return {
      history: activeSession.history || [],
      compactionIndex: this.findCompactionIndex(activeSession.history || []),
      sessionId: activeSession.sessionId,
      isRemoteMode,
    };
  }

  /**
   * Add a user message to the history
   */
  addUserMessage(content: string, contextItems: any[] = []): ChatHistoryItem {
    const newMessage = createHistoryItem({
      role: "user",
      content,
    }, contextItems);

    const newHistory = [...this.currentState.history, newMessage];
    this.setHistoryInternal(newHistory);

    logger.debug("Added user message", {
      contentLength: content.length,
      contextItemCount: contextItems.length,
      newHistoryLength: newHistory.length,
    });

    return newMessage;
  }

  /**
   * Add an assistant message to the history
   */
  addAssistantMessage(content: string, toolCalls?: any[]): ChatHistoryItem {
    const message: any = {
      role: "assistant",
      content,
    };

    if (toolCalls && toolCalls.length > 0) {
      message.toolCalls = toolCalls;
    }

    const toolCallStates = toolCalls?.map((tc) => {
      const id = tc.id;
      const name = tc.function?.name ?? tc.name;
      // Prefer explicit string arguments; otherwise stringify object arguments
      const rawArgStr =
        typeof tc.arguments === "string"
          ? tc.arguments
          : typeof tc.function?.arguments === "string"
            ? tc.function.arguments
            : tc.arguments !== undefined
              ? JSON.stringify(tc.arguments)
              : tc.function?.arguments !== undefined
                ? String(tc.function.arguments)
                : "{}";

      // parsedArgs: prefer object, else parse the string if possible
      let parsedArgs: any = {};
      if (tc && typeof tc.arguments === "object" && tc.arguments !== null) {
        parsedArgs = tc.arguments;
      } else if (typeof rawArgStr === "string") {
        try {
          parsedArgs = JSON.parse(rawArgStr);
        } catch {
          parsedArgs = {};
        }
      }

      return {
        toolCallId: id,
        toolCall: {
          id,
          type: "function" as const,
          function: {
            name,
            arguments: rawArgStr,
          },
        },
        status: "generated" as ToolStatus,
        parsedArgs,
      };
    });

    const newMessage = createHistoryItem(message, [], toolCallStates);
    const newHistory = [...this.currentState.history, newMessage];
    this.setHistoryInternal(newHistory);

    logger.debug("Added assistant message", {
      contentLength: content.length,
      toolCallCount: toolCalls?.length || 0,
      newHistoryLength: newHistory.length,
    });

    return newMessage;
  }

  /**
   * Add a system message to the history
   */
  addSystemMessage(content: string): ChatHistoryItem {
    const newMessage = createHistoryItem({
      role: "system",
      content,
    });

    const newHistory = [...this.currentState.history, newMessage];
    this.setState({
      history: newHistory,
    });

    if (!this.currentState.isRemoteMode) {
      updateSessionHistory(newHistory);
    }

    logger.debug("Added system message", {
      contentLength: content.length,
      newHistoryLength: newHistory.length,
    });

    return newMessage;
  }

  /**
   * Add a generic history item
   */
  addHistoryItem(item: ChatHistoryItem): ChatHistoryItem {
    const newHistory = [...this.currentState.history, item];
    this.setHistoryInternal(newHistory);

    logger.debug("Added history item", {
      role: item.message.role,
      newHistoryLength: newHistory.length,
    });

    return item;
  }

  /**
   * Update a tool call state within a message
   */
  updateToolCallState(
    messageIndex: number,
    toolCallId: string,
    updates: Partial<{
      status: ToolStatus;
      output: any[];
    }>
  ): void {
    const newHistory = [...this.currentState.history];
    const message = newHistory[messageIndex];

    if (!message?.toolCallStates) {
      logger.warn("No tool call states found at message index", {
        messageIndex,
        toolCallId,
      });
      return;
    }

    const toolState = message.toolCallStates.find(
      (ts) => ts.toolCallId === toolCallId
    );

    if (!toolState) {
      logger.warn("Tool call state not found", {
        messageIndex,
        toolCallId,
        availableIds: message.toolCallStates.map((ts) => ts.toolCallId),
      });
      return;
    }

    // Create a new message with updated tool state (immutable)
    newHistory[messageIndex] = {
      ...message,
      toolCallStates: message.toolCallStates.map((ts) =>
        ts.toolCallId === toolCallId
          ? { ...ts, ...updates }
          : ts
      ),
    };

    this.setHistoryInternal(newHistory);

    logger.debug("Updated tool call state", {
      messageIndex,
      toolCallId,
      updates,
    });
  }

  /**
   * Add a tool result to the history
   */
  addToolResult(toolCallId: string, result: string, status: ToolStatus = "done"): void {
    // Find the last assistant message with this tool call
    let targetIndex = -1;
    for (let i = this.currentState.history.length - 1; i >= 0; i--) {
      const item = this.currentState.history[i];
      if (item.message.role === "assistant" && item.toolCallStates) {
        const hasToolCall = item.toolCallStates.some(
          (ts) => ts.toolCallId === toolCallId
        );
        if (hasToolCall) {
          targetIndex = i;
          break;
        }
      }
    }

    if (targetIndex >= 0) {
      this.updateToolCallState(targetIndex, toolCallId, {
        status,
        output: [{
          content: result,
          name: "Tool Result",
          description: "Tool execution result",
        }],
      });
    } else {
      logger.warn("Could not find message for tool result", { toolCallId });
    }
  }

  /**
   * Perform compaction on the history
   */
  compact(newHistory: ChatHistoryItem[], compactionIndex: number): void {
    this.past.push([...this.currentState.history]);
    this.future = [];
    this.setState({ history: newHistory, compactionIndex });
    if (!this.currentState.isRemoteMode) {
      updateSessionHistory(newHistory);
    }

    logger.debug("Compacted history", {
      oldLength: this.currentState.history.length,
      newLength: newHistory.length,
      compactionIndex,
    });
  }

  /**
   * Clear the chat history
   */
  clear(): void {
    this.past.push([...this.currentState.history]);
    this.future = [];
    this.setState({ history: [], compactionIndex: null });
    if (!this.currentState.isRemoteMode) {
      updateSessionHistory([]);
    }

    logger.debug("Cleared chat history");
  }

  /**
   * Load a session into the service
   */
  async loadSession(sessionId: string): Promise<void> {
    const session = loadSessionById(sessionId);
    if (session) {
      this.setState({
        history: session.history,
        sessionId: session.sessionId,
        compactionIndex: this.findCompactionIndex(session.history),
      });

      logger.debug("Loaded session", {
        sessionId,
        historyLength: session.history.length,
      });
    } else {
      logger.warn("Session not found", { sessionId });
    }
  }

  /**
   * Get an immutable copy of the current history
   */
  getHistory(): ChatHistoryItem[] {
    return [...this.currentState.history];
  }

  /**
   * Get history for LLM (considering compaction)
   */
  getHistoryForLLM(compactionIndex?: number | null): ChatHistoryItem[] {
    const index = compactionIndex ?? this.currentState.compactionIndex;
    const full = this.currentState.history;
    if (index === null || index === undefined || index >= full.length) {
      return this.getHistory();
    }
    const systemMessage = full[0]?.message?.role === "system" ? full[0] : null;
    const messagesFromCompaction = full.slice(index);
    return systemMessage && index > 0
      ? [systemMessage, ...messagesFromCompaction]
      : messagesFromCompaction;
  }

  /**
   * Set the entire history (for remote mode or special cases)
   */
  setHistory(history: ChatHistoryItem[]): void {
    this.setHistoryInternal(history);
    logger.debug("Set entire history", {
      historyLength: history.length,
    });
  }

  /**
   * Update compaction index
   */
  setCompactionIndex(index: number | null): void {
    this.setState({
      compactionIndex: index,
    });

    logger.debug("Updated compaction index", { index });
  }

  /**
   * Find compaction index in history
   */
  private findCompactionIndex(history: ChatHistoryItem[]): number | null {
    const idx = history.findIndex((item) => item.conversationSummary !== undefined);
    return idx === -1 ? null : idx;
  }

  // Undo/Redo API
  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  undo(): void {
    if (!this.canUndo()) return;
    const prev = this.past.pop()!;
    this.future.push([...this.currentState.history]);
    this.setHistoryInternal(prev, { recordUndo: false });
  }

  redo(): void {
    if (!this.canRedo()) return;
    const next = this.future.pop()!;
    this.past.push([...this.currentState.history]);
    this.setHistoryInternal(next, { recordUndo: false });
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.currentState.sessionId;
  }

  

  /**
   * Check if in remote mode
   */
  isRemoteMode(): boolean {
    return this.currentState.isRemoteMode;
  }

  /**
   * Set remote mode
   */
  setRemoteMode(isRemote: boolean): void {
    this.setState({
      isRemoteMode: isRemote,
    });
  }

  /**
   * Override getState to ensure deep immutability for history array
   */
  getState(): ChatHistoryState {
    return {
      ...this.currentState,
      history: [...this.currentState.history],
    };
  }
}
