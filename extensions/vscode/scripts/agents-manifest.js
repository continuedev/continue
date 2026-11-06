/**
 * Turn this checkout's package.json into the "agents" build: declare the
 * proposed APIs and the chatSessions contribution that put Continued in VS
 * Code's Agents window (src/ai/agentSessions.ts).
 *
 * The Marketplace refuses extensions that declare proposed APIs, so the
 * normal build never has these. The agents build is attached to GitHub
 * releases only, and works in VS Code Insiders, or in Stable started with
 * `--enable-proposed-api b1tninja.continued`. Without that, VS Code ignores
 * the proposals and the extension works as the normal build.
 *
 * Usage: node scripts/agents-manifest.js   (edits package.json in place)
 */
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "package.json");
const pkg = JSON.parse(fs.readFileSync(file, "utf8"));

pkg.enabledApiProposals = ["chatSessionsProvider", "chatParticipantPrivate"];
pkg.contributes.chatSessions = [
  {
    // Must match SESSION_TYPE in src/ai/agentSessions.ts.
    type: "continued",
    name: "continued",
    displayName: "Continued",
    description:
      "An agent that uses the chat model and rules of your selected Continued config, with VS Code's tools.",
    icon: "$(hubot)",
    welcomeTitle: "Continued",
    welcomeMessage:
      "Runs on the chat model of your selected Continued config. It can use VS Code's tools, including MCP servers; VS Code asks before tools that need approval.",
    inputPlaceholder: "Ask Continued to do something",
  },
];

fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
console.log(
  `package.json: enabledApiProposals ${pkg.enabledApiProposals.join(", ")}; chatSessions "continued"`,
);
