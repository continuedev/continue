import { ChatHistoryItem } from "core";
import { stripImages } from "core/llm/images";


const sectionBreak = "=".repeat(80)
const subSectionBreak = "*".repeat(80)
const sectionHeader = (title: string) => sectionBreak + "\n" + title + "\n" + sectionBreak + "\n";

export function formattedChatHistoryItem(item: ChatHistoryItem): string {
    // Header 
    let header = sectionHeader("CHAT INTERACTION LOG")

    // Context Items
    let context = "\n" + sectionHeader("CONTEXT");
    if (item.modifiers) {
        context += `Modifiers:\nUse Codebase: ${item.modifiers.useCodebase}\nNo Context: ${item.modifiers.noContext}\n\n`;
        context += subSectionBreak + "\n"
    }
    if (item.contextItems.length > 0) {
        item.contextItems.forEach((contextItem, index) => {
            if (index !== 0) context += subSectionBreak + "\n"
            context += `Name: ${contextItem.name}\n`;
            context += `Description: ${contextItem.description}\n`;
            context += contextItem.editing ? `Editing: ${contextItem.editing}\n` : "";
            context += contextItem.editable ? `Editable: ${contextItem.editable}\n` : "";
            context += contextItem.icon ? `Icon: ${contextItem.icon}\n` : "";
            context += contextItem.uri ? `URI: ${JSON.stringify(contextItem.uri)}\n` : "";
            context += contextItem.content ? `Content:\n\n${contextItem.content}` : "";
        });
    } else {
        context += "No context items";
    };

    // For now seems redundant with prompts and completions
    // // Messages
    // let messages = "\n" + sectionHeader("MESSAGES");
    // const { role, content } = item.message;
    // messages += `${role.toUpperCase()}:\n`;
    // if (typeof content === "string") {
    //     messages += `${stripImages(content)}\n`;
    // } else {
    //     content.forEach(part => {
    //         if (part.type === "text") {
    //             messages += `${part.text}\n`;
    //         } else if (part.type === "imageUrl" && part.imageUrl) {
    //             messages += `Image URL: ${part.imageUrl.url}\n`;
    //         }
    //     });
    // }

    let promptsAndCompletions = "\n\n" + sectionHeader("PROMPTS AND COMPLETIONS");


    if (item.promptLogs && item.promptLogs.length > 0) {
        item.promptLogs.forEach((promptLog, index) => {
            if (index !== 0) promptsAndCompletions += subSectionBreak + "\n";

            // Model info and completion options
            promptsAndCompletions += `Model Title: ${promptLog.modelTitle}\n`;
            promptsAndCompletions += `Model: ${promptLog.completionOptions.model}\n`;

            for (const [key, value] of Object.entries(promptLog.completionOptions)) {
                if (value !== undefined && key !== "model") {
                    promptsAndCompletions += `${key}: ${value}\n`;
                }
            }
            promptsAndCompletions += `Prompt:\n\n${promptLog.prompt}`;
            promptsAndCompletions += `\nCompletion:\n\n${promptLog.completion}\n`;
        })

    } else {
        promptsAndCompletions += "No prompts/completions"
    }

    // Combine all parts
    const formattedLog = header + context + promptsAndCompletions;
    return formattedLog;
}
