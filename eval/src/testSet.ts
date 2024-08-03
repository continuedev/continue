import { TestSetItem } from "./TestSetItem.js";

const amplifiedDevRepo = "https://github.com/continuedev/amplified.dev";
const theXRepo = "https://github.com/sestinj/the-x";
const boltonsRepo = "https://github.com/sestinj/boltons";
const trayracerRepo = "https://github.com/sestinj/trayracer";
const continueRepo = "https://github.com/continuedev/continue";

export const filepathTestSet: TestSetItem[] = [
  {
    repo: continueRepo,
    query: "Where is our prettier config?",
    groundTruthFiles: [".prettierrc", ".prettierignore"],
  },
  {
    repo: continueRepo,
    query: "Where do we use codelens?",
    groundTruthFiles: [
      "extensions/vscode/src/lang-server/codeLens/providers/ConfigPyCodeLensProvider.ts",
      "extensions/vscode/src/lang-server/codeLens/providers/DiffViewerCodeLensProvider.ts",
      "extensions/vscode/src/lang-server/codeLens/providers/QuickActionsCodeLensProvider.ts",
    ],
  },
  {
    repo: continueRepo,
    query: "Where is our pretier config?",
    groundTruthFiles: [".prettierrc", ".prettierignore"],
  },
  {
    repo: continueRepo,
    query: "Tell me about the tsconfig in core",
    groundTruthFiles: ["core/tsconfig.json"],
  },
  // This is failing, potential solution is to add a column for file extension
  {
    repo: continueRepo,
    query: "Show me all of our .md files",
    groundTruthFiles: [
      "sync/src/sync_db.rs",
      "extensions/vscode/manual-testing-sandbox/test.rs",
    ],
  },
];

// Need a way to specify specific snippets within files
export const rerankerTestSet: TestSetItem[] = [
  /** https://github.com/continuedev/amplified.dev */
  {
    repo: amplifiedDevRepo,
    query: "How can I create an architecture of participation?",
    groundTruthFiles: ["index.md"],
  },

  /** https://github.com/sestinj/the-x */
  {
    repo: theXRepo,
    query: "How are floats multiplied?",
    groundTruthFiles: [
      "the-x/packages/contracts/src/libs/Q128x128.sol",
      "the-x/packages/contracts/src/dex/ADex.sol",
      "the-x/packages/contracts/tests/AMM.ts",
    ],
  },
  {
    // Should understand that sign up means "Login"
    repo: theXRepo,
    query: "Make a red border around the sign up box if it is invalid",
    groundTruthFiles: [
      "the-x/packages/react-app/src/components/Login/LoginModal.tsx",
      "the-x/packages/react-app/src/components/Login/components/index.ts",
      "the-x/packages/react-app/src/components/Login/LoginButton.tsx",
    ],
  },
  {
    // "Layout" is the key word here, and there's a folder with the name
    repo: theXRepo,
    query: "Where is the layout defined?",
    groundTruthFiles: [
      "the-x/packages/react-app/src/components/Layout/SideBar.tsx",
      "the-x/packages/react-app/src/components/Layout/SideBarData.tsx",
      "the-x/packages/react-app/src/components/Layout/SideBarIcon.tsx",
      "the-x/packages/react-app/src/components/Layout/index.tsx",
    ],
  },
  {
    // There are many places where balance is gotten in one way or another
    repo: theXRepo,
    query: "How do we get the balance for an account?",
    groundTruthFiles: [
      "the-x/packages/react-app/src/libs/etherscan/index.ts",
      "the-x/packages/react-app/src/routes/portfolio.tsx",
      "the-x/packages/react-app/src/components/charts/PortfolioPie.tsx",
      "the-x/packages/contracts/scripts/hardhatDeployCDex.ts",
      "the-x/packages/react-app/src/routes/faucet.tsx",
      "the-x/packages/contracts/scripts/deployFaucet.ts",
      "the-x/packages/react-app/src/routes/exchange.tsx",
      "the-x/packages/contracts/scripts/setupLocalTokens.ts",
      "the-x/packages/contracts/archive/src/Faucet/Faucet.sol",
      "the-x/packages/contracts/src/other/AFaucet.sol",
    ],
  },
  /** https://github.com/sestinj/boltons */
  {
    repo: boltonsRepo,
    query: "How would I add a new test for traceback utils?",
    groundTruthFiles: ["tests/test_tbutils.py", "boltons/tbutils.py"],
  },

  /** https://github.com/sestinj/trayracer */
  {
    repo: trayracerRepo,
    query: "How do I add a new material?",
    groundTruthFiles: ["material.h"],
  },
  {
    repo: trayracerRepo,
    query: "Is there a way to draw arbitrary objects?",
    groundTruthFiles: ["mesh.h", "triangle.h"],
  },
  /** https://github.com/continuedev/continue */
  {
    // This is an example of following data flow that can't be followed directly by the LSP
    // Maybe files that are edited together?
    repo: continueRepo,
    query:
      "How do I modify the chat history so users can rename their old chats?",
    groundTruthFiles: [
      "gui/src/pages/history.tsx",
      "core/util/history.ts",
      "gui/src/hooks/useHistory.tsx",
      "core/core.ts",
    ],
  },
  {
    repo: continueRepo,
    query: "How are new custom commands created?",
    groundTruthFiles: [
      "docs/docs/customization/slash-commands.md",
      "core/commands/index.ts",
      "gui/src/components/mainInput/getSuggestion.ts",
      "core/config/promptFile.ts",
      "docs/docs/walkthroughs/prompt-files.md",
    ],
  },
];
