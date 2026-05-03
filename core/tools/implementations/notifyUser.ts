import { ToolImpl } from ".";
import { getStringArg } from "../parseArgs";

export const notifyUserImpl: ToolImpl = async (args, extras) => {
  const message = getStringArg(args, "message");
  const status: string =
    typeof args?.status === "string" ? args.status : "normal";
  const attachmentPaths: string[] =
    Array.isArray(args?.attachments) ? args.attachments : [];

  const contextItems = [
    {
      name: status === "proactive" ? "Proactive Notification" : "Notification",
      description: message,
      content: message,
    },
  ];

  // Read any attached files and include their content as additional context items.
  for (const filePath of attachmentPaths) {
    try {
      const content = await extras.ide.readFile(filePath);
      if (content) {
        contextItems.push({
          name: filePath.split("/").pop() ?? filePath,
          description: `Attached file: ${filePath}`,
          content: `**${filePath}**\n\n\`\`\`\n${content}\n\`\`\``,
        });
      }
    } catch {
      // Non-fatal: skip unreadable attachments
      contextItems.push({
        name: filePath.split("/").pop() ?? filePath,
        description: `Could not read: ${filePath}`,
        content: `Could not read file: ${filePath}`,
      });
    }
  }

  return contextItems;
};
