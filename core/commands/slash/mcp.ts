import { Client } from "@modelcontextprotocol/sdk/client/index.js";

import { ChatMessage, MessagePart, SlashCommand, UserChatMessage } from "../../index.js";
import { renderChatMessage } from "../../util/messageContent.js";

function findLastIndex<T>(array: T[], predicate: (value: T) => boolean): number {
  if (!array || array.length === 0) {
    return -1;
  }
  
  for (let i = array.length - 1; i >= 0; i--) {
    if (predicate(array[i])) {
      return i;
    }
  }
  
  return -1;
}
/**
 *  Function substitutes the content of the message with the prompt
 *  Find the last text message that contains the input in content,
 *  and removes all the ocurrences of input in content of the found part.
 *  Keep the part in place with new content
 *  Insert prompt messages before the found message, or at the start
 *  of array if no message is found.
 * 
 * @param content original content
 * @param input string to be replaced
 * @param prompt replacement content
 * @returns new content with inserted prompt
 */
function substituteContent(content: MessagePart[], input: string, prompt: MessagePart[]): MessagePart[] {
  // Create a copy of the original content to avoid modifying the input
  const newContent = [...content];
  
  // Find the last text message part that contains the input
  const foundIndex = findLastIndex(newContent,(part) => part.type === "text" && part.text.includes(input));
  
  if (foundIndex !== -1) {
    // Found a part containing the input
    const part = newContent[foundIndex];
    if (part.type === "text") {
      // Remove all occurrences of input from the text
      const updatedText = part.text.replace(input,'');
      // Update the part with the new text
      newContent[foundIndex] = { ...part, text: updatedText };
    }
    
    // Insert prompt messages before the found message
    newContent.splice(foundIndex, 0, ...prompt);
  } else {
    // No message found containing the input, insert at the start
    newContent.unshift(...prompt);
  }
  
  return newContent;
}

/**
 * Function substitutes prompt messages into the history.
 * The action is cumbersome, because history may contain multiple
 * messages, and prompt may contain multiple messages. And prompt should be
 * inserted before the last user message in history, replacing original slash command.
 * Also, each message may be just a text, or an array of MessagePart with text or image.
 * Finds the last user message in the chat history and substitutes its content
 * using the substituteContent function. Handles both string and MessagePart[] content types.
 * 
 * @param messages Array of chat messages
 * @param input String to be replaced in the last user message
 * @param prompt Replacement content to be inserted
 * @returns New array of messages with the substitution applied
 */
function substituteLastUserMessage(messages: ChatMessage[], input: string, prompt: ChatMessage[]): ChatMessage[] {
  // Create a copy of the messages array
  const newMessages = [...messages];
  
  // Find the last user message
  const lastUserMessageIndex = findLastIndex(newMessages,(msg) => msg.role === "user");
  
  if (lastUserMessageIndex === -1) {
    // No user message found
    if (newMessages.length > 0) {
      // Insert prompts before the last message, which is expected to be empty assistant
      newMessages.splice(newMessages.length - 1, 0, ...prompt);
    } else {
      // Return a single message array with just the prompt
      return prompt;
    }
  } else {
    
    const lastUserPromptIndex = findLastIndex(prompt,(msg) => msg.role === "user");

    let promptContent: MessagePart[];
    if (lastUserPromptIndex === -1) {
      // No user messages in prompt, insert them before the last user message
      newMessages.splice(lastUserMessageIndex, 0, ...prompt);
      promptContent = [];
    } else {
      // User messages in prompt, insert all but last user prompt before the last user message
      newMessages.splice(lastUserMessageIndex, 0, ...prompt.slice(0, lastUserPromptIndex ));
      promptContent = prompt[lastUserPromptIndex].content as MessagePart[];
    }
    // Get the last user message
    const userMessage = newMessages[lastUserMessageIndex];
    
    // Convert string content to MessagePart[] if needed
    let contentAsArray: MessagePart[];
    const content = userMessage.content;
    if (typeof content === "string") {
      contentAsArray = [{ type: "text", text: content }];
    } else {
      contentAsArray = userMessage.content as MessagePart[];
    }
    
    // Apply substituteContent function
    const newContent = substituteContent(contentAsArray, input, promptContent);
    
    // Create a new user message with the substituted content
    const newUserMessage: UserChatMessage = {
      role: "user",
      content: newContent
    };
    
    // Replace the old user message with the new one
    newMessages[lastUserMessageIndex] = newUserMessage;
    
  }
  return newMessages;
}

export function constructMcpSlashCommand(
  client: Client,
  name: string,
  description?: string,
  args?: string[],
): SlashCommand {
  return {
    name,
    description: description ?? "MCP Prompt",
    // params: {},
    run: async function* ({ input, llm, ide, history,  completionOptions }) {
      // Extract user input after the command
      const userInput = input.startsWith(`/${name}`)
        ? input.slice(name.length + 1).trimStart()
        : input;

      // Prepare arguments for MCP client
      // some special arguments to tell MCP about the context
      const argsObject: { [key: string]: string } = {};
      if (args) {
        args.forEach((arg) => {
          switch (arg) {
            case "model":argsObject["model"] = llm.model;
            break;
            case "history": argsObject["history"] = JSON.stringify(history);
            break;
            default:
              argsObject[arg] = userInput;
          }
        });
      }

      // Get prompt from MCP
      const result = await client.getPrompt({ name, arguments: argsObject });

      // Convert MCP messages to ChatMessage format
      const mcpMessages: ChatMessage[] = result.messages.map((msg) => {
        if (msg.content.type === "text") {
          return {
            content: [{
              type: "text",
              text: msg.content.text,
            }],
            role: msg.role,
          };
        } else {
          throw new Error(`Unsupported message type: ${msg.content.type}`);
        }
      });

      // substitute prompt into history
      const messages = substituteLastUserMessage(history, `/${name} `, mcpMessages);
      
      // Stream the response
      for await (const chunk of llm.streamChat(
        messages,
        new AbortController().signal,
        completionOptions,
      )) {
        yield renderChatMessage(chunk);
      }
    },
  };
}