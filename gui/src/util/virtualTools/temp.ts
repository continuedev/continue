// Note this only works because new message above
// // was already rendered from parts to string
// lastMessage.content += messageContent;

// if (lastMessage.role === "assistant") {
//   const xmlToolCalls = getXmlToolCallsFromContent(
//     renderChatMessage(lastMessage),
//     lastMessage.toolCalls ?? [],
//   );
//   if (xmlToolCalls.length > 0) {
//     const toolCall = xmlToolCalls[0]; // Only support one for now
//     lastMessage.toolCalls = [toolCall];
//     lastItem.toolCallState = {
//       status: "done",
//       toolCall: toolCall,
//       parsedArgs: JSON.parse(toolCall.function.arguments),
//       toolCallId: toolCall.id,
//     };
//   }
// }
