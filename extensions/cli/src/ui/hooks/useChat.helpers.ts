import * as path from "node:path";

import type { ChatHistoryItem, Session } from "core/index.js";
import { getLastNPathParts } from "core/util/uri.js";
import { v4 as uuidv4 } from "uuid";

import { compactChatHistory } from "../../compaction.js";
import { DEFAULT_SESSION_TITLE } from "../../constants/session.js";
import {
  loadSession,
  startNewSession,
  updateSessionHistory,
} from "../../session.js";
import { posthogService } from "../../telemetry/posthogService.js";
import { telemetryService } from "../../telemetry/telemetryService.js";
import { formatError } from "../../util/formatError.js";
import { logger } from "../../util/logger.js";
import { shouldAutoCompact } from "../../util/tokenizer.js";

import { SlashCommandResult } from "./useChat.types.js";

/**
 * Dynamically import Sharp without using eval
 */
async function loadSharp(): Promise<any> {
  try {
    // Use Function constructor to avoid bundler issues with dynamic imports
    const importSharp = new Function('return import("sharp")');
    const sharpModule = await importSharp().catch(() => null);
    return sharpModule ? (sharpModule.default || sharpModule) : null;
  } catch {
    return null;
  }
}

/**
 * Process image buffer to JPEG with resizing using Sharp (if available)
 */
async function processImageWithSharp(imageBuffer: Buffer, maxWidth = 1024, maxHeight = 1024): Promise<{ buffer: Buffer; isJpeg: boolean }> {
  try {
    // Try to load Sharp - it's an optional dependency
    const sharp = await loadSharp();
    if (!sharp) {
      logger.debug("Sharp not available, using original image buffer");
      return { buffer: imageBuffer, isJpeg: false };
    }

    logger.debug("Processing image with Sharp...");
    
    // Process image: convert to JPEG and resize if needed
    const processedBuffer = await sharp(imageBuffer)
      .resize(maxWidth, maxHeight, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .jpeg({ 
        quality: 85,
        progressive: true 
      })
      .toBuffer();

    logger.debug(`Image processed with Sharp: ${imageBuffer.length} bytes -> ${processedBuffer.length} bytes`);
    return { buffer: processedBuffer, isJpeg: true };
  } catch (error) {
    logger.warn("Failed to process image with Sharp, using original:", error);
    return { buffer: imageBuffer, isJpeg: false };
  }
}

/**
 * Detect image format from buffer header - simplified to reduce complexity
 */
function detectImageFormat(buffer: Buffer): string {
  if (buffer.length < 4) return 'image/png';
  
  const signature = buffer.subarray(0, 4);
  
  // JPEG: FF D8 FF
  if (signature[0] === 0xFF && signature[1] === 0xD8 && signature[2] === 0xFF) {
    return 'image/jpeg';
  }
  
  // PNG: 89 50 4E 47
  if (signature[0] === 0x89 && signature[1] === 0x50 && signature[2] === 0x4E && signature[3] === 0x47) {
    return 'image/png';
  }
  
  // GIF: 47 49 46 38
  if (signature[0] === 0x47 && signature[1] === 0x49 && signature[2] === 0x46 && signature[3] === 0x38) {
    return 'image/gif';
  }
  
  // WebP: RIFF + WEBP at offset 8
  if (signature[0] === 0x52 && signature[1] === 0x49 && buffer.length >= 12) {
    const webpSig = buffer.subarray(8, 12);
    if (webpSig[0] === 0x57 && webpSig[1] === 0x45 && webpSig[2] === 0x42 && webpSig[3] === 0x50) {
      return 'image/webp';
    }
  }
  
  return 'image/png'; // Default fallback
}

/**
 * Process a single image placeholder - extracted to reduce nesting depth
 */
async function processImagePlaceholder(
  placeholder: string,
  originalImageBuffer: Buffer,
  textContent: string,
  messageParts: import("core/index.js").MessagePart[]
): Promise<{ textContent: string }> {
  logger.debug(`Processing image placeholder: ${placeholder}, original size: ${originalImageBuffer.length} bytes`);
  
  try {
    // Process image with Sharp (convert to JPEG and resize)
    const processResult = await processImageWithSharp(originalImageBuffer);
    const processedImageBuffer = processResult.buffer;
    const isProcessedJpeg = processResult.isJpeg;
    
    // Check processed image size
    const maxSize = 10 * 1024 * 1024; // 10MB limit
    if (processedImageBuffer.length > maxSize) {
      logger.warn(`Processed image is still too large (${Math.round(processedImageBuffer.length / 1024 / 1024)}MB). Skipping image.`);
      return { textContent: textContent.replace(placeholder, "[Large image skipped - reduce image size and try again]") };
    }
    
    // Convert processed buffer to base64 data URL asynchronously to avoid blocking
    logger.debug("Converting processed image to base64...");
    const base64Image = await new Promise<string>((resolve) => {
      // Use setImmediate to yield to event loop
      setImmediate(() => {
        const result = processedImageBuffer.toString('base64');
        resolve(result);
      });
    });
    
    // Use correct MIME type based on whether Sharp processing was successful
    const mimeType = isProcessedJpeg ? 'image/jpeg' : detectImageFormat(processedImageBuffer);
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    logger.debug(`Image converted to base64 with MIME type ${mimeType}, dataUrl length: ${dataUrl.length}`);
    
    // Split text around the placeholder
    const parts = textContent.split(placeholder);
    if (parts.length > 1) {
      // Add text before placeholder
      if (parts[0]) {
        messageParts.push({
          type: "text",
          text: parts[0],
        });
      }
      
      // Add image part
      messageParts.push({
        type: "imageUrl",
        imageUrl: { url: dataUrl },
      });
      
      // Continue with remaining text
      return { textContent: parts.slice(1).join(placeholder) };
    }
    
    return { textContent };
  } catch (error) {
    logger.error(`Failed to process image ${placeholder}:`, error);
    return { textContent: textContent.replace(placeholder, "[Image processing failed]") };
  }
}

/**
 * Initialize chat history
 */
export async function initChatHistory(
  resume?: boolean,
  _additionalRules?: string[],
): Promise<ChatHistoryItem[]> {
  if (resume) {
    const savedSession = loadSession();
    if (savedSession) {
      return savedSession.history;
    }
  }

  // Start with empty history - system message will be injected when needed
  return [];
}

/**
 * Handle /config command
 */
export function handleConfigCommand(onShowConfigSelector: () => void): void {
  posthogService.capture("useSlashCommand", {
    name: "config",
  });
  onShowConfigSelector();
}

interface HandleCompactCommandOptions {
  chatHistory: ChatHistoryItem[];
  model: any;
  llmApi: any;
  setChatHistory: React.Dispatch<React.SetStateAction<ChatHistoryItem[]>>;
  setCompactionIndex: React.Dispatch<React.SetStateAction<number | null>>;
  currentSession: Session;
  setCurrentSession: React.Dispatch<React.SetStateAction<Session>>;
}

/**
 * Handle compaction command
 */
export async function handleCompactCommand({
  chatHistory,
  model,
  llmApi,
  setChatHistory,
  setCompactionIndex,
  currentSession,
  setCurrentSession,
}: HandleCompactCommandOptions): Promise<void> {
  // Add compacting message
  setChatHistory((prev) => [
    ...prev,
    {
      message: {
        role: "system",
        content: "Compacting chat history...",
      },
      contextItems: [],
    },
  ]);

  try {
    // Compact the chat history directly (already in unified format)
    const result = await compactChatHistory(chatHistory, model, llmApi);

    // Replace chat history with compacted version
    setChatHistory(result.compactedHistory);
    setCompactionIndex(result.compactionIndex);

    // Save the compacted session
    const updatedSession: Session = {
      ...currentSession,
      history: result.compactedHistory,
    };
    updateSessionHistory(result.compactedHistory);
    setCurrentSession(updatedSession);

    setChatHistory((prev) => [
      ...prev,
      {
        message: {
          role: "system",
          content: "Chat history compacted successfully.",
        },
        contextItems: [],
      },
    ]);
  } catch (error) {
    logger.error("Compaction failed:", error);
    setChatHistory((prev) => [
      ...prev,
      {
        message: {
          role: "system",
          content: `Compaction failed: ${formatError(error)}`,
        },
        contextItems: [],
      },
    ]);
  }
}

interface ProcessSlashCommandResultOptions {
  result: SlashCommandResult;
  chatHistory: ChatHistoryItem[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatHistoryItem[]>>;
  exit: () => void;
  onShowConfigSelector: () => void;
  onShowModelSelector?: () => void;
  onShowMCPSelector?: () => void;
  onShowSessionSelector?: () => void;
  onClear?: () => void;
}

/**
 * Process slash command results
 */
export function processSlashCommandResult({
  result,
  chatHistory,
  setChatHistory,
  exit,
  onShowConfigSelector,
  onShowModelSelector,
  onShowMCPSelector,
  onShowSessionSelector,
  onClear,
}: ProcessSlashCommandResultOptions): string | null {
  if (result.exit) {
    exit();
    return null;
  }

  if (result.openMcpSelector) {
    onShowMCPSelector?.();
    return null;
  }

  if (result.openConfigSelector) {
    onShowConfigSelector();
    return null;
  }

  if (result.openModelSelector && onShowModelSelector) {
    onShowModelSelector();
    return null;
  }

  if (result.openSessionSelector && onShowSessionSelector) {
    onShowSessionSelector();
    return null;
  }

  if (result.clear) {
    const systemMessage = chatHistory.find(
      (item) => item.message.role === "system",
    );
    const newHistory = systemMessage ? [systemMessage] : [];

    // Start a new session with a new sessionId
    startNewSession(newHistory);

    setChatHistory(newHistory);

    // Reset intro message state to show it again after clearing
    if (onClear) {
      onClear();
    }

    if (result.output) {
      setChatHistory([
        {
          message: {
            role: "system",
            content: result.output,
          },
          contextItems: [],
        },
      ]);
    }
    return null;
  }

  if (result.output) {
    setChatHistory((prev) => [
      ...prev,
      {
        message: {
          role: "system",
          content: result.output || "",
        },
        contextItems: [],
      },
    ]);
  }

  return result.newInput || null;
}

/**
 * Format message with attached files and images - returns a complete ChatHistoryItem
 */
export async function formatMessageWithFiles(
  message: string,
  attachedFiles: Array<{ path: string; content: string }>,
  imageMap?: Map<string, Buffer>,
): Promise<import("core/index.js").ChatHistoryItem> {
  // Convert attached files to context items
  const contextItems = attachedFiles.map((file) => ({
    id: {
      providerTitle: "file",
      itemId: uuidv4(),
    },
    content: file.content,
    name: path.basename(file.path),
    description: getLastNPathParts(file.path, 2),
    uri: {
      type: "file" as const,
      value: `file://${file.path}`,
    },
  }));

  // Process message content for images
  let messageContent: import("core/index.js").MessageContent = message;
  
  if (imageMap && imageMap.size > 0) {
    const messageParts: import("core/index.js").MessagePart[] = [];
    let textContent = message;

    // Replace image placeholders with image parts
    for (const [placeholder, originalImageBuffer] of imageMap.entries()) {
      const result = await processImagePlaceholder(placeholder, originalImageBuffer, textContent, messageParts);
      textContent = result.textContent;
    }
    
    // Add any remaining text
    if (textContent) {
      messageParts.push({
        type: "text",
        text: textContent,
      });
    }

    // Use message parts if we have images, otherwise keep as string
    if (messageParts.length > 0) {
      messageContent = messageParts;
    }
  }

  return {
    message: {
      role: "user",
      content: messageContent,
    },
    contextItems,
  };
}

/**
 * Track telemetry for user message
 */
export function trackUserMessage(message: string, model?: any): void {
  telemetryService.startActiveTime();
  telemetryService.logUserPrompt(message.length, message);
  posthogService.capture("chat", {
    model: model?.name,
    provider: model?.provider,
  });
}

interface HandleSpecialCommandsOptions {
  message: string;
  isRemoteMode: boolean;
  remoteUrl?: string;
  onShowConfigSelector: () => void;
  exit: () => void;
  setChatHistory: React.Dispatch<React.SetStateAction<ChatHistoryItem[]>>;
}

/**
 * Handle special TUI commands
 */
export async function handleSpecialCommands({
  message,
  isRemoteMode,
  remoteUrl,
  onShowConfigSelector,
  exit,
  setChatHistory,
}: HandleSpecialCommandsOptions): Promise<boolean> {
  const trimmedMessage = message.trim();

  // Special handling for /config command in TUI
  if (trimmedMessage === "/config") {
    handleConfigCommand(onShowConfigSelector);
    return true;
  }

  // Handle /exit command in remote mode
  if (isRemoteMode && remoteUrl && trimmedMessage === "/exit") {
    const { handleRemoteExit } = await import("./useChat.remote.helpers.js");
    await handleRemoteExit(remoteUrl, setChatHistory, exit);
    return true;
  }

  return false;
}

interface HandleAutoCompactionOptions {
  chatHistory: ChatHistoryItem[];
  model: any;
  llmApi: any;
  compactionIndex: number | null;
  setChatHistory: React.Dispatch<React.SetStateAction<ChatHistoryItem[]>>;
  setCompactionIndex: React.Dispatch<React.SetStateAction<number | null>>;
}

/**
 * Handle auto-compaction when approaching context limit - TUI wrapper
 */
export async function handleAutoCompaction({
  chatHistory,
  model,
  llmApi,
  compactionIndex: _compactionIndex,
  setChatHistory,
  setCompactionIndex,
}: HandleAutoCompactionOptions): Promise<{
  currentChatHistory: ChatHistoryItem[];
  currentCompactionIndex: number | null;
}> {
  try {
    // Check if auto-compaction is needed
    // Check if auto-compaction is needed using ChatHistoryItem directly
    if (!model || !shouldAutoCompact(chatHistory, model)) {
      return {
        currentChatHistory: chatHistory,
        currentCompactionIndex: _compactionIndex,
      };
    }

    logger.info("Auto-compaction triggered for TUI mode");

    // Add compacting message
    setChatHistory((prev) => [
      ...prev,
      {
        message: {
          role: "system",
          content: "Auto-compacting chat history...",
        },
        contextItems: [],
      },
    ]);

    // Compact the unified history
    const result = await compactChatHistory(chatHistory, model, llmApi);

    // Keep the system message and append the compaction summary
    // This replaces the old messages with a summary to reduce context size
    const systemMessage = chatHistory.find(
      (item) => item.message.role === "system",
    );

    const compactedMessage: ChatHistoryItem = {
      message: {
        role: "assistant" as const,
        content: result.compactionContent,
      },
      contextItems: [],
      conversationSummary: result.compactionContent, // Mark this as a summary
    };

    // Create new history with system message (if exists) and compaction summary
    const updatedHistory: ChatHistoryItem[] = systemMessage
      ? [systemMessage, compactedMessage]
      : [compactedMessage];

    setChatHistory(updatedHistory);
    setCompactionIndex(updatedHistory.length - 1);

    // Add success message
    setChatHistory((prev) => [
      ...prev,
      {
        message: {
          role: "system",
          content: "✓ Chat history auto-compacted successfully.",
        },
        contextItems: [],
      },
    ]);

    return {
      currentChatHistory: updatedHistory,
      currentCompactionIndex: updatedHistory.length - 1,
    };
  } catch (error) {
    logger.error("Auto-compaction failed:", error);

    // Add error message
    setChatHistory((prev) => [
      ...prev,
      {
        message: {
          role: "system",
          content: `Auto-compaction failed: ${formatError(error)}. Continuing without compaction...`,
        },
        contextItems: [],
      },
    ]);

    return {
      currentChatHistory: chatHistory,
      currentCompactionIndex: null,
    };
  }
}

/**
 * Generate a title for the session based on the first assistant response
 */
export async function generateSessionTitle(
  assistantResponse: string,
  llmApi: any,
  model: any,
  currentSessionTitle?: string,
): Promise<string | undefined> {
  // Only generate title for untitled sessions
  if (currentSessionTitle && currentSessionTitle !== DEFAULT_SESSION_TITLE) {
    return undefined;
  }

  if (!assistantResponse || !llmApi || !model) {
    return undefined;
  }

  try {
    const { ChatDescriber } = await import("core/util/chatDescriber.js");
    const generatedTitle = await ChatDescriber.describeWithBaseLlmApi(
      llmApi,
      model,
      assistantResponse,
    );

    logger.debug("Generated session title", {
      original: currentSessionTitle,
      generated: generatedTitle,
    });

    return generatedTitle;
  } catch (error) {
    logger.error("Failed to generate session title:", error);
    return undefined;
  }
}
