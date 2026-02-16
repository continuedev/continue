const {
  validateAndPrepareMessages,
} = require("./packages/openai-adapters/dist/util/deepseek-converters.js");

console.log("=== Analyse der validateAndPrepareMessages Funktion ===\n");
console.log(
  "Ziel: Prüfen, ob die Funktion sicherstellt, dass jede Nachricht im reasoning tool call chain",
);
console.log(
  'ein reasoning_content Feld definiert (auch wenn nur ""). Der letzte tool call chain der',
);
console.log(
  "Konversation hat reasoning_content Pflicht und beginnt ab der letzten user nachricht.\n",
);

// Helper to analyze messages
function analyzeChain(messages, description) {
  console.log(`\n--- ${description} ---`);
  console.log("Eingabe:");
  messages.forEach((msg, i) => {
    console.log(
      `  [${i}] ${msg.role}: ${JSON.stringify(msg.content).substring(0, 40)} ${msg.reasoning_content ? `reasoning: "${msg.reasoning_content}"` : ""} ${msg.tool_calls ? `tool_calls: ${msg.tool_calls.length}` : ""}`,
    );
  });

  const warnings = [];
  const result = validateAndPrepareMessages(messages, warnings, true);

  console.log("\nAusgabe:");
  result.forEach((msg, i) => {
    const info = `[${i}] ${msg.role}: ${JSON.stringify(msg.content).substring(0, 40)}`;
    const extras = [];
    if (msg.reasoning_content !== undefined)
      extras.push(`reasoning_content: "${msg.reasoning_content}"`);
    if (msg.tool_calls) extras.push(`tool_calls: ${msg.tool_calls.length}`);
    console.log(
      `  ${info} ${extras.length > 0 ? `(${extras.join(", ")})` : ""}`,
    );
  });

  if (warnings.length > 0) {
    console.log("\nWarnungen:", warnings);
  }

  // Check requirements
  const lastUserIndex = result.findIndex((m) => m.role === "user");
  const assistantsAfterLastUser = result
    .slice(lastUserIndex + 1)
    .filter((m) => m.role === "assistant");

  console.log("\nAnalyse:");
  console.log(
    `  - Assistant-Nachrichten nach letzter User-Nachricht: ${assistantsAfterLastUser.length}`,
  );

  const assistantsWithReasoning = assistantsAfterLastUser.filter(
    (a) => a.reasoning_content !== undefined,
  );
  const assistantsWithToolCalls = assistantsAfterLastUser.filter(
    (a) => a.tool_calls,
  );
  const assistantsWithoutToolCalls = assistantsAfterLastUser.filter(
    (a) => !a.tool_calls,
  );

  console.log(
    `  - Davon mit reasoning_content: ${assistantsWithReasoning.length}`,
  );
  console.log(
    `  - Assistant mit Tool-Calls: ${assistantsWithToolCalls.length}`,
  );
  console.log(
    `  - Assistant ohne Tool-Calls (finale Antworten): ${assistantsWithoutToolCalls.length}`,
  );

  // Check each assistant after last user
  assistantsAfterLastUser.forEach((assistant, i) => {
    const hasReasoning = assistant.reasoning_content !== undefined;
    const hasToolCalls = assistant.tool_calls;
    console.log(
      `    Assistant ${i}: ${hasToolCalls ? "mit Tool-Calls" : "ohne Tool-Calls"} - reasoning_content: ${hasReasoning ? `"${assistant.reasoning_content}"` : "UNDEFINIERT"}`,
    );
  });

  return { result, warnings };
}

// Scenario 1: Simple tool call chain without reasoning_content
const scenario1 = [
  { role: "user", content: "Get data" },
  {
    role: "assistant",
    content: "",
    tool_calls: [
      {
        id: "call_1",
        type: "function",
        function: { name: "fetch", arguments: "{}" },
      },
    ],
  },
  { role: "tool", content: "data", tool_call_id: "call_1" },
  { role: "assistant", content: "Here is the data" },
];

// Scenario 2: Multiple tool calls with existing reasoning_content
const scenario2 = [
  { role: "user", content: "Process" },
  {
    role: "assistant",
    content: "",
    reasoning_content: "First step",
    tool_calls: [
      {
        id: "call_1",
        type: "function",
        function: { name: "step1", arguments: "{}" },
      },
    ],
  },
  { role: "tool", content: "result1", tool_call_id: "call_1" },
  {
    role: "assistant",
    content: "",
    reasoning_content: "",
    tool_calls: [
      {
        id: "call_2",
        type: "function",
        function: { name: "step2", arguments: "{}" },
      },
    ],
  },
  { role: "tool", content: "result2", tool_call_id: "call_2" },
  {
    role: "assistant",
    content: "All done",
    reasoning_content: "Final summary",
  },
];

// Scenario 3: Chain starts after last user message (previous history before)
const scenario3 = [
  { role: "user", content: "First question" },
  { role: "assistant", content: "First answer" },
  { role: "user", content: "Second question" },
  {
    role: "assistant",
    content: "",
    tool_calls: [
      {
        id: "call_1",
        type: "function",
        function: { name: "tool", arguments: "{}" },
      },
    ],
  },
  { role: "tool", content: "result", tool_call_id: "call_1" },
  { role: "assistant", content: "Final answer" },
];

// Scenario 4: Complex chain with mixed reasoning_content
const scenario4 = [
  { role: "user", content: "Help me" },
  {
    role: "assistant",
    content: "",
    tool_calls: [
      {
        id: "call_1",
        type: "function",
        function: { name: "helper", arguments: "{}" },
      },
    ],
  },
  { role: "tool", content: "help1", tool_call_id: "call_1" },
  {
    role: "assistant",
    content: "",
    reasoning_content: "Thinking...",
    tool_calls: [
      {
        id: "call_2",
        type: "function",
        function: { name: "helper2", arguments: "{}" },
      },
    ],
  },
  { role: "tool", content: "help2", tool_call_id: "call_2" },
  { role: "assistant", content: "All done" },
];

// Run analysis
analyzeChain(
  scenario1,
  "Szenario 1: Einfache Tool-Call-Chain ohne reasoning_content",
);
analyzeChain(scenario2, "Szenario 2: Chain mit vorhandenem reasoning_content");
analyzeChain(scenario3, "Szenario 3: Chain beginnt ab letzter User-Nachricht");
analyzeChain(scenario4, "Szenario 4: Gemischte Chain");

console.log("\n=== FAZIT ===");
console.log(
  "Die aktuelle Implementierung (kompilierte Version) erfüllt NICHT die Anforderung, dass",
);
console.log(
  "jede Assistant-Nachricht im reasoning tool call chain ein reasoning_content Feld definiert.",
);
console.log("\nBeobachtungen:");
console.log(
  "1. reasoning_content wird NUR beibehalten, wenn es bereits in der Eingabe-Nachricht vorhanden ist.",
);
console.log(
  "2. reasoning_content wird NICHT als leerer String hinzugefügt, selbst wenn Assistant Tool-Calls hat.",
);
console.log(
  '3. Der Kommentar im Code weist darauf hin, dass "self-invented" reasoning_content von der',
);
console.log("   DeepSeek API verboten ist und 400 Fehler verursachen kann.");
console.log("\nSchlussfolgerung:");
console.log(
  "- Entweder ist die Anforderung falsch (die DeepSeek API benötigt kein reasoning_content für",
);
console.log("  Assistant-Nachrichten ohne vorheriges reasoning_content)");
console.log(
  '- Oder die aktuelle Implementierung ist fehlerhaft und muss reasoning_content = "" für',
);
console.log(
  "  Assistant-Nachrichten mit Tool-Calls nach der letzten User-Nachricht hinzufügen.",
);
console.log("\nEmpfehlung:");
console.log(
  "Die TypeScript-Quelle (mit reverse Logik und firstUserMsgPassed) scheint eine ältere",
);
console.log(
  'Implementierung zu sein, die reasoning_content = "" setzt. Die kompilierte Version wurde',
);
console.log(
  "offenbar aktualisiert, um self-invented reasoning_content zu vermeiden.",
);
console.log(
  "Es sollte geklärt werden, welche Version korrekt ist und ob die DeepSeek API wirklich",
);
console.log("leeres reasoning_content für Tool-Call-Chains erfordert.");
