/**
 * Battle test suite for Anthropic prompt caching.
 *
 * Tests diverse real-world scenarios to validate caching works correctly
 * across tool use, long conversations, large payloads, and edge cases.
 *
 * Guarded by ANTHROPIC_API_KEY env var — skipped if not set.
 * Uses claude-haiku-4-5-20251001 to minimize cost.
 *
 * IMPORTANT: Haiku 4.5 requires a minimum of 4096 tokens for caching.
 *
 * Run: ANTHROPIC_API_KEY=sk-ant-... npx vitest packages/openai-adapters/src/test/anthropic-caching-scenarios.live.test.ts
 */
import { describe, expect, test } from "vitest";

import { constructLlmApi } from "../index.js";

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-haiku-4-5-20251001";

// ─── Shared fixtures ────────────────────────────────────────────────

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "read_file",
      description:
        "Read the contents of a file at the given path. Use this when you need to examine existing files in the project. The output includes line numbers prefixed to each line (e.g., '1 | const x = 1'). When reading large files, you may want to specify a line range using the start_line and end_line parameters.",
      parameters: {
        type: "object" as const,
        required: ["path"],
        properties: {
          path: {
            type: "string",
            description:
              "The path of the file to read, relative to the workspace root",
          },
          start_line: {
            type: "number",
            description:
              "The starting line number to read from (1-indexed, inclusive)",
          },
          end_line: {
            type: "number",
            description:
              "The ending line number to read to (1-indexed, inclusive)",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "write_file",
      description:
        "Write content to a file at the given path. If the file exists, it will be overwritten. If it doesn't exist, a new file will be created. Always provide the complete intended content of the file.",
      parameters: {
        type: "object" as const,
        required: ["path", "content"],
        properties: {
          path: {
            type: "string",
            description:
              "The path of the file to write to, relative to the workspace root",
          },
          content: {
            type: "string",
            description: "The full content to write to the file",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "run_terminal_command",
      description:
        "Run a terminal command in the workspace directory. Use this for executing build commands, running tests, installing packages, or any other command-line operations.",
      parameters: {
        type: "object" as const,
        required: ["command"],
        properties: {
          command: {
            type: "string",
            description: "The terminal command to execute",
          },
          workingDir: {
            type: "string",
            description: "The working directory for the command",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_files",
      description:
        "List files and directories at the given path. If the path is a directory, lists all files and subdirectories within it.",
      parameters: {
        type: "object" as const,
        required: [],
        properties: {
          path: {
            type: "string",
            description:
              "The path to list files from, relative to the workspace root",
          },
          recursive: {
            type: "boolean",
            description: "Whether to list files recursively in subdirectories",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_code",
      description:
        "Search for a pattern across all files in the project. Returns matching lines with file paths and line numbers. Supports regex patterns.",
      parameters: {
        type: "object" as const,
        required: ["pattern"],
        properties: {
          pattern: {
            type: "string",
            description: "The search pattern (supports regex)",
          },
          file_glob: {
            type: "string",
            description: "Optional glob pattern to filter files",
          },
          max_results: {
            type: "number",
            description: "Maximum number of results to return",
          },
        },
      },
    },
  },
];

// System message large enough to exceed Haiku 4.5's 4096-token minimum
// when combined with the tool definitions above.
const SYSTEM_MESSAGE = `You are an AI coding assistant integrated into a developer's IDE. You help with software engineering tasks including writing code, debugging, explaining code, and more.

# Environment

- Operating System: macOS 14.0
- Shell: zsh
- IDE: VS Code 1.95.0
- Working Directory: /Users/developer/projects/my-app
- Git Branch: feature/user-management
- Node.js: v20.11.0
- npm: 10.2.4
- TypeScript: 5.3.3
- Docker: 24.0.6
- PostgreSQL: 16.1

# Project Context

This is a full-stack TypeScript monorepo using pnpm workspaces. The project is a team collaboration platform with the following packages:

- packages/core: Shared business logic, database models, and services
- packages/api: Express.js REST API with WebSocket support
- packages/web: Next.js frontend with React components
- packages/shared: Shared types, constants, and validators

# Directory Listing

\`\`\`
my-app/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── deploy.yml
│   │   ├── release.yml
│   │   ├── codeql-analysis.yml
│   │   └── dependency-review.yml
│   ├── CODEOWNERS
│   ├── pull_request_template.md
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md
│       ├── feature_request.md
│       └── config.yml
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   │   ├── index.ts
│   │   │   │   ├── jwt.ts
│   │   │   │   ├── oauth.ts
│   │   │   │   ├── middleware.ts
│   │   │   │   ├── rbac.ts
│   │   │   │   ├── session.ts
│   │   │   │   └── types.ts
│   │   │   ├── database/
│   │   │   │   ├── index.ts
│   │   │   │   ├── connection.ts
│   │   │   │   ├── migrations/
│   │   │   │   │   ├── 001_create_users.ts
│   │   │   │   │   ├── 002_create_projects.ts
│   │   │   │   │   ├── 003_create_teams.ts
│   │   │   │   │   ├── 004_create_notifications.ts
│   │   │   │   │   └── 005_create_audit_log.ts
│   │   │   │   ├── models/
│   │   │   │   │   ├── User.ts
│   │   │   │   │   ├── Project.ts
│   │   │   │   │   ├── Team.ts
│   │   │   │   │   ├── TeamMember.ts
│   │   │   │   │   ├── Notification.ts
│   │   │   │   │   ├── AuditLog.ts
│   │   │   │   │   └── index.ts
│   │   │   │   └── seeds/
│   │   │   │       ├── development.ts
│   │   │   │       └── test.ts
│   │   │   ├── services/
│   │   │   │   ├── user.service.ts
│   │   │   │   ├── project.service.ts
│   │   │   │   ├── team.service.ts
│   │   │   │   ├── notification.service.ts
│   │   │   │   ├── analytics.service.ts
│   │   │   │   ├── email.service.ts
│   │   │   │   ├── cache.service.ts
│   │   │   │   └── search.service.ts
│   │   │   ├── events/
│   │   │   │   ├── index.ts
│   │   │   │   ├── emitter.ts
│   │   │   │   ├── handlers/
│   │   │   │   │   ├── user.handler.ts
│   │   │   │   │   ├── project.handler.ts
│   │   │   │   │   └── notification.handler.ts
│   │   │   │   └── types.ts
│   │   │   ├── queue/
│   │   │   │   ├── index.ts
│   │   │   │   ├── workers/
│   │   │   │   │   ├── email.worker.ts
│   │   │   │   │   ├── analytics.worker.ts
│   │   │   │   │   └── cleanup.worker.ts
│   │   │   │   └── types.ts
│   │   │   └── utils/
│   │   │       ├── logger.ts
│   │   │       ├── errors.ts
│   │   │       ├── validation.ts
│   │   │       ├── crypto.ts
│   │   │       ├── date.ts
│   │   │       └── retry.ts
│   │   ├── tests/
│   │   │   ├── auth.test.ts
│   │   │   ├── services.test.ts
│   │   │   ├── events.test.ts
│   │   │   ├── queue.test.ts
│   │   │   └── utils.test.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── api/
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── users.ts
│   │   │   │   ├── projects.ts
│   │   │   │   ├── teams.ts
│   │   │   │   ├── webhooks.ts
│   │   │   │   ├── health.ts
│   │   │   │   ├── search.ts
│   │   │   │   └── admin.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── rateLimit.ts
│   │   │   │   ├── cors.ts
│   │   │   │   ├── requestId.ts
│   │   │   │   ├── logging.ts
│   │   │   │   └── validation.ts
│   │   │   ├── websocket/
│   │   │   │   ├── index.ts
│   │   │   │   ├── handlers.ts
│   │   │   │   └── types.ts
│   │   │   └── index.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── web/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── common/
│   │   │   │   │   ├── Button.tsx
│   │   │   │   │   ├── Input.tsx
│   │   │   │   │   ├── Modal.tsx
│   │   │   │   │   ├── Table.tsx
│   │   │   │   │   └── Loading.tsx
│   │   │   │   ├── layout/
│   │   │   │   │   ├── Header.tsx
│   │   │   │   │   ├── Footer.tsx
│   │   │   │   │   ├── Sidebar.tsx
│   │   │   │   │   └── Layout.tsx
│   │   │   │   ├── dashboard/
│   │   │   │   │   ├── Dashboard.tsx
│   │   │   │   │   ├── ProjectCard.tsx
│   │   │   │   │   ├── ActivityFeed.tsx
│   │   │   │   │   └── Stats.tsx
│   │   │   │   ├── settings/
│   │   │   │   │   ├── Settings.tsx
│   │   │   │   │   ├── ProfileForm.tsx
│   │   │   │   │   ├── SecuritySettings.tsx
│   │   │   │   │   └── NotificationPrefs.tsx
│   │   │   │   └── team/
│   │   │   │       ├── TeamList.tsx
│   │   │   │       ├── TeamDetail.tsx
│   │   │   │       ├── MemberList.tsx
│   │   │   │       └── InviteForm.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useAuth.ts
│   │   │   │   ├── useApi.ts
│   │   │   │   ├── useTheme.ts
│   │   │   │   ├── useWebSocket.ts
│   │   │   │   ├── useDebounce.ts
│   │   │   │   └── usePagination.ts
│   │   │   ├── pages/
│   │   │   │   ├── index.tsx
│   │   │   │   ├── login.tsx
│   │   │   │   ├── register.tsx
│   │   │   │   ├── dashboard.tsx
│   │   │   │   ├── settings.tsx
│   │   │   │   ├── project/[id].tsx
│   │   │   │   └── team/[id].tsx
│   │   │   ├── store/
│   │   │   │   ├── index.ts
│   │   │   │   ├── authSlice.ts
│   │   │   │   ├── projectSlice.ts
│   │   │   │   └── uiSlice.ts
│   │   │   ├── styles/
│   │   │   │   ├── globals.css
│   │   │   │   └── theme.ts
│   │   │   ├── lib/
│   │   │   │   ├── api.ts
│   │   │   │   ├── auth.ts
│   │   │   │   └── utils.ts
│   │   │   └── App.tsx
│   │   ├── public/
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── shared/
│       ├── src/
│       │   ├── types/
│       │   │   ├── user.ts
│       │   │   ├── project.ts
│       │   │   ├── team.ts
│       │   │   ├── api.ts
│       │   │   └── index.ts
│       │   ├── constants/
│       │   │   ├── permissions.ts
│       │   │   ├── errors.ts
│       │   │   └── config.ts
│       │   └── validators/
│       │       ├── user.ts
│       │       ├── project.ts
│       │       └── team.ts
│       ├── package.json
│       └── tsconfig.json
├── infrastructure/
│   ├── terraform/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── modules/
│   │       ├── vpc/
│   │       ├── ecs/
│   │       ├── rds/
│   │       └── redis/
│   ├── docker/
│   │   ├── Dockerfile.api
│   │   ├── Dockerfile.web
│   │   └── docker-compose.prod.yml
│   └── k8s/
│       ├── deployment.yaml
│       ├── service.yaml
│       ├── ingress.yaml
│       └── configmap.yaml
├── scripts/
│   ├── deploy.sh
│   ├── setup.sh
│   ├── seed-db.ts
│   ├── migrate.ts
│   └── health-check.sh
├── .env.example
├── .eslintrc.js
├── .gitignore
├── .prettierrc
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── README.md
└── tsconfig.base.json
\`\`\`

# Code Style

- Use 2-space indentation for TypeScript/JavaScript
- Use single quotes for strings, prefer const over let
- Strict TypeScript with no implicit any
- PascalCase for types/interfaces/classes/components, camelCase for variables/functions
- Named exports over default exports
- async/await over raw promises
- Add JSDoc comments for public API functions
- Prefer functional patterns and early returns
- Template literals over string concatenation
- Explicit error handling, never swallow exceptions

# Testing

- Unit tests for all business logic, integration tests for API routes
- describe/it blocks with descriptive names, AAA pattern
- Mock external dependencies, 80% coverage minimum on new code
- Test error cases and edge cases, not just happy paths`;

// ─── Helpers ────────────────────────────────────────────────────────

/** Total input tokens = cache_read + cache_write + uncached (prompt_tokens) */
function totalInputTokens(usage: any): number {
  const details = usage.prompt_tokens_details;
  return (
    (details?.cache_read_tokens ?? 0) +
    (details?.cache_write_tokens ?? 0) +
    usage.prompt_tokens
  );
}

function cacheHitRate(usage: any): number {
  const total = totalInputTokens(usage);
  const read = usage.prompt_tokens_details?.cache_read_tokens ?? 0;
  return total > 0 ? read / total : 0;
}

function makeApi() {
  return constructLlmApi({
    provider: "anthropic",
    apiKey: API_KEY!,
  })!;
}

const signal = new AbortController().signal;

// ─── Tests ──────────────────────────────────────────────────────────

describe.skipIf(!API_KEY)(
  "Anthropic Prompt Caching - Battle Test Scenarios",
  () => {
    // ── Scenario 1: Tool use round-trip ──────────────────────────
    // Simulates: user asks to read a file → assistant calls read_file →
    // tool result with file content → assistant explains → user follow-up.
    // Validates caching with tool_use and tool_result blocks in conversation.
    describe("Scenario 1: Tool use round-trip", () => {
      const api = makeApi();
      let turn1Content = "";

      test(
        "Turn 1: initial request with tool use history creates cache",
        { timeout: 30_000 },
        async () => {
          // Simulate a conversation where the assistant already called a tool
          // and we're continuing with the tool result + follow-up
          const response = await api.chatCompletionNonStream(
            {
              model: MODEL,
              messages: [
                { role: "system", content: SYSTEM_MESSAGE },
                {
                  role: "user",
                  content: "Can you read the user service file?",
                },
                {
                  role: "assistant",
                  content: null,
                  tool_calls: [
                    {
                      id: "toolu_01abc",
                      type: "function",
                      function: {
                        name: "read_file",
                        arguments: JSON.stringify({
                          path: "packages/core/src/services/user.service.ts",
                        }),
                      },
                    },
                  ],
                },
                {
                  role: "tool",
                  tool_call_id: "toolu_01abc",
                  content: [
                    "1 | import { db } from '../database';",
                    "2 | import { User, CreateUserInput } from '../database/models/User';",
                    "3 | import { hashPassword, verifyPassword } from '../utils/crypto';",
                    "4 | import { logger } from '../utils/logger';",
                    "5 | import { AppError } from '../utils/errors';",
                    "6 |",
                    "7 | export class UserService {",
                    "8 |   async createUser(input: CreateUserInput): Promise<User> {",
                    "9 |     const existing = await db.users.findByEmail(input.email);",
                    "10|     if (existing) throw new AppError('EMAIL_EXISTS', 'Email already registered');",
                    "11|     const hashedPassword = await hashPassword(input.password);",
                    "12|     return db.users.create({ ...input, password: hashedPassword });",
                    "13|   }",
                    "14|",
                    "15|   async getUserById(id: string): Promise<User | null> {",
                    "16|     return db.users.findById(id);",
                    "17|   }",
                    "18|",
                    "19|   async updateUser(id: string, updates: Partial<User>): Promise<User> {",
                    "20|     const user = await this.getUserById(id);",
                    "21|     if (!user) throw new AppError('NOT_FOUND', 'User not found');",
                    "22|     return db.users.update(id, updates);",
                    "23|   }",
                    "24|",
                    "25|   async deleteUser(id: string): Promise<void> {",
                    "26|     await db.users.delete(id);",
                    "27|   }",
                    "28|",
                    "29|   async authenticateUser(email: string, password: string): Promise<User> {",
                    "30|     const user = await db.users.findByEmail(email);",
                    "31|     if (!user) throw new AppError('AUTH_FAILED', 'Invalid credentials');",
                    "32|     const valid = await verifyPassword(password, user.password);",
                    "33|     if (!valid) throw new AppError('AUTH_FAILED', 'Invalid credentials');",
                    "34|     return user;",
                    "35|   }",
                    "36| }",
                  ].join("\n"),
                },
                {
                  role: "user",
                  content:
                    "I see the user service. Can you add a method to search users by name?",
                },
              ],
              tools: TOOLS,
              max_tokens: 256,
            },
            signal,
          );

          const usage = response.usage!;
          const details = usage.prompt_tokens_details as any;
          turn1Content =
            response.choices[0].message.content ?? "Here's the method.";

          expect(details?.cache_write_tokens).toBeGreaterThan(0);

          console.log("Scenario 1 Turn 1:", {
            cache_write: details?.cache_write_tokens,
            cache_read: details?.cache_read_tokens,
            total: totalInputTokens(usage),
          });
        },
      );

      test(
        "Turn 2: follow-up after tool use hits cache",
        { timeout: 30_000 },
        async () => {
          const response = await api.chatCompletionNonStream(
            {
              model: MODEL,
              messages: [
                { role: "system", content: SYSTEM_MESSAGE },
                {
                  role: "user",
                  content: "Can you read the user service file?",
                },
                {
                  role: "assistant",
                  content: null,
                  tool_calls: [
                    {
                      id: "toolu_01abc",
                      type: "function",
                      function: {
                        name: "read_file",
                        arguments: JSON.stringify({
                          path: "packages/core/src/services/user.service.ts",
                        }),
                      },
                    },
                  ],
                },
                {
                  role: "tool",
                  tool_call_id: "toolu_01abc",
                  content: [
                    "1 | import { db } from '../database';",
                    "2 | import { User, CreateUserInput } from '../database/models/User';",
                    "3 | import { hashPassword, verifyPassword } from '../utils/crypto';",
                    "4 | import { logger } from '../utils/logger';",
                    "5 | import { AppError } from '../utils/errors';",
                    "6 |",
                    "7 | export class UserService {",
                    "8 |   async createUser(input: CreateUserInput): Promise<User> {",
                    "9 |     const existing = await db.users.findByEmail(input.email);",
                    "10|     if (existing) throw new AppError('EMAIL_EXISTS', 'Email already registered');",
                    "11|     const hashedPassword = await hashPassword(input.password);",
                    "12|     return db.users.create({ ...input, password: hashedPassword });",
                    "13|   }",
                    "14|",
                    "15|   async getUserById(id: string): Promise<User | null> {",
                    "16|     return db.users.findById(id);",
                    "17|   }",
                    "18|",
                    "19|   async updateUser(id: string, updates: Partial<User>): Promise<User> {",
                    "20|     const user = await this.getUserById(id);",
                    "21|     if (!user) throw new AppError('NOT_FOUND', 'User not found');",
                    "22|     return db.users.update(id, updates);",
                    "23|   }",
                    "24|",
                    "25|   async deleteUser(id: string): Promise<void> {",
                    "26|     await db.users.delete(id);",
                    "27|   }",
                    "28|",
                    "29|   async authenticateUser(email: string, password: string): Promise<User> {",
                    "30|     const user = await db.users.findByEmail(email);",
                    "31|     if (!user) throw new AppError('AUTH_FAILED', 'Invalid credentials');",
                    "32|     const valid = await verifyPassword(password, user.password);",
                    "33|     if (!valid) throw new AppError('AUTH_FAILED', 'Invalid credentials');",
                    "34|     return user;",
                    "35|   }",
                    "36| }",
                  ].join("\n"),
                },
                {
                  role: "user",
                  content:
                    "I see the user service. Can you add a method to search users by name?",
                },
                { role: "assistant", content: turn1Content },
                {
                  role: "user",
                  content:
                    "Good. Now also add pagination support to that search method.",
                },
              ],
              tools: TOOLS,
              max_tokens: 256,
            },
            signal,
          );

          const usage = response.usage!;
          const details = usage.prompt_tokens_details as any;
          const rate = cacheHitRate(usage);

          expect(details?.cache_read_tokens).toBeGreaterThan(0);
          expect(rate).toBeGreaterThan(0.5);

          console.log("Scenario 1 Turn 2:", {
            cache_write: details?.cache_write_tokens,
            cache_read: details?.cache_read_tokens,
            hit_rate: rate.toFixed(3),
          });
        },
      );
    });

    // ── Scenario 2: Parallel tool calls ──────────────────────────
    // Simulates: assistant calls multiple tools at once (read_file +
    // list_files), both return results, then user asks follow-up.
    // Validates caching with multiple tool_use + tool_result blocks.
    describe("Scenario 2: Parallel tool calls", () => {
      const api = makeApi();

      test(
        "Turn 1: conversation with parallel tool calls creates cache",
        { timeout: 30_000 },
        async () => {
          const response = await api.chatCompletionNonStream(
            {
              model: MODEL,
              messages: [
                { role: "system", content: SYSTEM_MESSAGE },
                {
                  role: "user",
                  content:
                    "Show me the team routes and list the test files for the API package.",
                },
                {
                  role: "assistant",
                  content: null,
                  tool_calls: [
                    {
                      id: "toolu_read1",
                      type: "function",
                      function: {
                        name: "read_file",
                        arguments: JSON.stringify({
                          path: "packages/api/src/routes/teams.ts",
                        }),
                      },
                    },
                    {
                      id: "toolu_list1",
                      type: "function",
                      function: {
                        name: "list_files",
                        arguments: JSON.stringify({
                          path: "packages/api/tests",
                          recursive: true,
                        }),
                      },
                    },
                  ],
                },
                {
                  role: "tool",
                  tool_call_id: "toolu_read1",
                  content: [
                    "1 | import { Router } from 'express';",
                    "2 | import { TeamService } from '@my-app/core';",
                    "3 | import { authMiddleware } from '../middleware/auth';",
                    "4 | import { validateBody } from '../middleware/validation';",
                    "5 |",
                    "6 | const router = Router();",
                    "7 | const teamService = new TeamService();",
                    "8 |",
                    "9 | router.get('/', authMiddleware, async (req, res) => {",
                    "10|   const teams = await teamService.listTeams(req.user.id);",
                    "11|   res.json({ teams });",
                    "12| });",
                    "13|",
                    "14| router.post('/', authMiddleware, validateBody('createTeam'), async (req, res) => {",
                    "15|   const team = await teamService.createTeam(req.body, req.user.id);",
                    "16|   res.status(201).json({ team });",
                    "17| });",
                    "18|",
                    "19| export { router as teamRoutes };",
                  ].join("\n"),
                },
                {
                  role: "tool",
                  tool_call_id: "toolu_list1",
                  content:
                    "routes/\n  users.test.ts\n  projects.test.ts\n  teams.test.ts\nmiddleware/\n  auth.test.ts\n  rateLimit.test.ts",
                },
                {
                  role: "user",
                  content:
                    "Good. The team routes look basic. Can you add CRUD endpoints for team members?",
                },
              ],
              tools: TOOLS,
              max_tokens: 256,
            },
            signal,
          );

          const usage = response.usage!;
          const details = usage.prompt_tokens_details as any;
          expect(details?.cache_write_tokens).toBeGreaterThan(0);

          console.log("Scenario 2 Turn 1:", {
            cache_write: details?.cache_write_tokens,
            total: totalInputTokens(usage),
          });
        },
      );

      test(
        "Turn 2: follow-up after parallel tool calls hits cache",
        { timeout: 30_000 },
        async () => {
          const response = await api.chatCompletionNonStream(
            {
              model: MODEL,
              messages: [
                { role: "system", content: SYSTEM_MESSAGE },
                {
                  role: "user",
                  content:
                    "Show me the team routes and list the test files for the API package.",
                },
                {
                  role: "assistant",
                  content: null,
                  tool_calls: [
                    {
                      id: "toolu_read1",
                      type: "function",
                      function: {
                        name: "read_file",
                        arguments: JSON.stringify({
                          path: "packages/api/src/routes/teams.ts",
                        }),
                      },
                    },
                    {
                      id: "toolu_list1",
                      type: "function",
                      function: {
                        name: "list_files",
                        arguments: JSON.stringify({
                          path: "packages/api/tests",
                          recursive: true,
                        }),
                      },
                    },
                  ],
                },
                {
                  role: "tool",
                  tool_call_id: "toolu_read1",
                  content: [
                    "1 | import { Router } from 'express';",
                    "2 | import { TeamService } from '@my-app/core';",
                    "3 | import { authMiddleware } from '../middleware/auth';",
                    "4 | import { validateBody } from '../middleware/validation';",
                    "5 |",
                    "6 | const router = Router();",
                    "7 | const teamService = new TeamService();",
                    "8 |",
                    "9 | router.get('/', authMiddleware, async (req, res) => {",
                    "10|   const teams = await teamService.listTeams(req.user.id);",
                    "11|   res.json({ teams });",
                    "12| });",
                    "13|",
                    "14| router.post('/', authMiddleware, validateBody('createTeam'), async (req, res) => {",
                    "15|   const team = await teamService.createTeam(req.body, req.user.id);",
                    "16|   res.status(201).json({ team });",
                    "17| });",
                    "18|",
                    "19| export { router as teamRoutes };",
                  ].join("\n"),
                },
                {
                  role: "tool",
                  tool_call_id: "toolu_list1",
                  content:
                    "routes/\n  users.test.ts\n  projects.test.ts\n  teams.test.ts\nmiddleware/\n  auth.test.ts\n  rateLimit.test.ts",
                },
                {
                  role: "user",
                  content:
                    "Good. The team routes look basic. Can you add CRUD endpoints for team members?",
                },
                {
                  role: "assistant",
                  content:
                    "I'll add the team member CRUD endpoints to the routes file.",
                },
                {
                  role: "user",
                  content: "Also add appropriate validation middleware.",
                },
              ],
              tools: TOOLS,
              max_tokens: 256,
            },
            signal,
          );

          const usage = response.usage!;
          const rate = cacheHitRate(usage);
          expect(rate).toBeGreaterThan(0.5);

          console.log("Scenario 2 Turn 2:", {
            cache_read: usage.prompt_tokens_details?.cache_read_tokens,
            hit_rate: rate.toFixed(3),
          });
        },
      );
    });

    // ── Scenario 3: Long conversation (8 turns) ─────────────────
    // Simulates an extended debugging session with many back-and-forth
    // exchanges. Validates cache accumulates over many turns.
    test(
      "Scenario 3: Long 8-turn conversation maintains high cache rate",
      { timeout: 60_000 },
      async () => {
        const api = makeApi();
        const messages: any[] = [
          { role: "system", content: SYSTEM_MESSAGE },
          {
            role: "user",
            content:
              "I'm getting a TypeScript error in the auth middleware. The error is: Type 'string | undefined' is not assignable to type 'string'. How do I fix it?",
          },
        ];

        const exchanges = [
          "The error suggests that `req.headers.authorization` might be undefined. You need to add a null check before using it.",
          "Can you show me what the fix would look like in code?",
          "Here's the fix:\n```typescript\nconst authHeader = req.headers.authorization;\nif (!authHeader) {\n  return res.status(401).json({ error: 'Missing authorization header' });\n}\nconst token = authHeader.split(' ')[1];\n```",
          "That works but now I'm getting a different error: jwt.verify is throwing 'TokenExpiredError'. How should I handle that?",
          "You should wrap the jwt.verify call in a try-catch and handle TokenExpiredError specifically:\n```typescript\ntry {\n  const decoded = jwt.verify(token, SECRET);\n  req.user = decoded;\n} catch (err) {\n  if (err instanceof jwt.TokenExpiredError) {\n    return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });\n  }\n  return res.status(401).json({ error: 'Invalid token' });\n}\n```",
          "Should I also handle the refresh token flow here or in a separate middleware?",
          "I'd recommend a separate middleware for refresh tokens. Keep the auth middleware focused on validating access tokens. Create a new `refreshToken.ts` middleware that handles the refresh flow, checks the refresh token's validity, and issues a new access token pair.",
          "Makes sense. One more thing - should I add rate limiting specifically to the refresh endpoint?",
        ];

        let lastRate = 0;

        for (let i = 0; i < exchanges.length; i++) {
          const isAssistant = i % 2 === 0;
          messages.push({
            role: isAssistant ? "assistant" : "user",
            content: exchanges[i],
          });

          // Only make API calls on user turns (odd indices)
          if (!isAssistant) {
            const response = await api.chatCompletionNonStream(
              {
                model: MODEL,
                messages: [...messages],
                tools: TOOLS,
                max_tokens: 256,
              },
              signal,
            );

            const usage = response.usage!;
            const rate = cacheHitRate(usage);
            const details = usage.prompt_tokens_details as any;

            console.log(`Scenario 3 turn ${Math.ceil((i + 1) / 2)}:`, {
              cache_read: details?.cache_read_tokens,
              cache_write: details?.cache_write_tokens,
              hit_rate: rate.toFixed(3),
              total: totalInputTokens(usage),
            });

            // After the first user turn creates cache, subsequent turns should read
            if (i > 1) {
              expect(details?.cache_read_tokens).toBeGreaterThan(0);
              lastRate = rate;
            }

            // Use actual response as next assistant message
            messages.push({
              role: "assistant",
              content:
                response.choices[0].message.content ??
                exchanges[i + 1] ??
                "Done.",
            });
          }
        }

        // Final turn should have high hit rate
        expect(lastRate).toBeGreaterThan(0.5);
      },
    );

    // ── Scenario 4: Large tool result (simulating file read) ─────
    // Simulates reading a large file that returns ~500 lines of code.
    // Validates caching works with large tool_result content blocks.
    describe("Scenario 4: Large tool result payload", () => {
      const api = makeApi();

      // Generate a realistic large file (~200 lines of TypeScript)
      const largeFileContent = Array.from({ length: 200 }, (_, i) => {
        const line = i + 1;
        if (line === 1)
          return `${line} | import { Injectable } from '@nestjs/common';`;
        if (line === 2)
          return `${line} | import { InjectRepository } from '@nestjs/typeorm';`;
        if (line === 3)
          return `${line} | import { Repository, Like, In } from 'typeorm';`;
        if (line <= 5)
          return `${line} | import { ${["Logger", "HttpException", "HttpStatus"][line - 4]} } from '@nestjs/common';`;
        if (line === 6) return `${line} |`;
        if (line === 7) return `${line} | @Injectable()`;
        if (line === 8) return `${line} | export class ProjectService {`;
        if (line === 9)
          return `${line} |   private readonly logger = new Logger(ProjectService.name);`;
        if (line === 10) return `${line} |`;
        // Generate method stubs every ~20 lines
        if (line % 20 === 0)
          return `${line} |   async method${line / 20}(args: Record<string, unknown>): Promise<void> {`;
        if (line % 20 === 1)
          return `${line} |     this.logger.log('Executing method${Math.floor(line / 20)}');`;
        if (line % 20 === 2)
          return `${line} |     const result = await this.repository.findOne({ where: args });`;
        if (line % 20 === 3)
          return `${line} |     if (!result) throw new HttpException('Not found', HttpStatus.NOT_FOUND);`;
        if (line % 20 === 4) return `${line} |     return result;`;
        if (line % 20 === 5) return `${line} |   }`;
        if (line % 20 === 6) return `${line} |`;
        return `${line} |   // ${["validate input", "transform data", "check permissions", "audit log", "notify subscribers", "update cache", "emit event", "retry on failure", "parse response", "handle error", "sanitize output", "rate limit check", "circuit breaker"][line % 13]}`;
      }).join("\n");

      test(
        "Turn 1: request with large tool result creates cache",
        { timeout: 30_000 },
        async () => {
          const response = await api.chatCompletionNonStream(
            {
              model: MODEL,
              messages: [
                { role: "system", content: SYSTEM_MESSAGE },
                {
                  role: "user",
                  content: "Read the project service file, it's quite long.",
                },
                {
                  role: "assistant",
                  content: null,
                  tool_calls: [
                    {
                      id: "toolu_bigfile",
                      type: "function",
                      function: {
                        name: "read_file",
                        arguments: JSON.stringify({
                          path: "packages/core/src/services/project.service.ts",
                        }),
                      },
                    },
                  ],
                },
                {
                  role: "tool",
                  tool_call_id: "toolu_bigfile",
                  content: largeFileContent,
                },
                {
                  role: "user",
                  content:
                    "That's a big file. Can you summarize the main methods?",
                },
              ],
              tools: TOOLS,
              max_tokens: 256,
            },
            signal,
          );

          const usage = response.usage!;
          const details = usage.prompt_tokens_details as any;
          const total = totalInputTokens(usage);

          expect(details?.cache_write_tokens).toBeGreaterThan(0);
          expect(total).toBeGreaterThan(5000); // Should be a substantial request

          console.log("Scenario 4 Turn 1:", {
            cache_write: details?.cache_write_tokens,
            total,
          });
        },
      );

      test(
        "Turn 2: follow-up on large file hits cache",
        { timeout: 30_000 },
        async () => {
          const response = await api.chatCompletionNonStream(
            {
              model: MODEL,
              messages: [
                { role: "system", content: SYSTEM_MESSAGE },
                {
                  role: "user",
                  content: "Read the project service file, it's quite long.",
                },
                {
                  role: "assistant",
                  content: null,
                  tool_calls: [
                    {
                      id: "toolu_bigfile",
                      type: "function",
                      function: {
                        name: "read_file",
                        arguments: JSON.stringify({
                          path: "packages/core/src/services/project.service.ts",
                        }),
                      },
                    },
                  ],
                },
                {
                  role: "tool",
                  tool_call_id: "toolu_bigfile",
                  content: largeFileContent,
                },
                {
                  role: "user",
                  content:
                    "That's a big file. Can you summarize the main methods?",
                },
                {
                  role: "assistant",
                  content:
                    "The file contains a ProjectService class with 10 methods covering standard CRUD operations.",
                },
                {
                  role: "user",
                  content:
                    "Can you refactor method5 to use a transaction instead of a raw query?",
                },
              ],
              tools: TOOLS,
              max_tokens: 256,
            },
            signal,
          );

          const usage = response.usage!;
          const rate = cacheHitRate(usage);
          expect(rate).toBeGreaterThan(0.5);

          console.log("Scenario 4 Turn 2:", {
            cache_read: usage.prompt_tokens_details?.cache_read_tokens,
            hit_rate: rate.toFixed(3),
          });
        },
      );
    });

    // ── Scenario 5: Cache invalidation on system message change ──
    // Same conversation but with a modified system message.
    // Should get a cache miss (everything re-written).
    test(
      "Scenario 5: Modified system message invalidates cache",
      { timeout: 30_000 },
      async () => {
        const api = makeApi();

        // First request with original system message
        const resp1 = await api.chatCompletionNonStream(
          {
            model: MODEL,
            messages: [
              { role: "system", content: SYSTEM_MESSAGE },
              {
                role: "user",
                content: "Explain the project architecture briefly.",
              },
            ],
            tools: TOOLS,
            max_tokens: 128,
          },
          signal,
        );

        const usage1 = resp1.usage!;
        const details1 = usage1.prompt_tokens_details as any;
        const writeTokens1 = details1?.cache_write_tokens ?? 0;

        // Second request with MODIFIED system message (added a line)
        const modifiedSystem =
          SYSTEM_MESSAGE + "\n\n# Additional Context\n- DEBUG MODE: enabled";

        const resp2 = await api.chatCompletionNonStream(
          {
            model: MODEL,
            messages: [
              { role: "system", content: modifiedSystem },
              {
                role: "user",
                content: "Explain the project architecture briefly.",
              },
            ],
            tools: TOOLS,
            max_tokens: 128,
          },
          signal,
        );

        const usage2 = resp2.usage!;
        const details2 = usage2.prompt_tokens_details as any;

        // Modified system message should cause a cache miss — new write, no read
        // (or minimal read if only the tail changed and prefix still matches)
        const read2 = details2?.cache_read_tokens ?? 0;
        const write2 = details2?.cache_write_tokens ?? 0;

        // The key assertion: when system message changes, we should see new
        // cache writes and minimal/no cache reads from the FIRST request's cache
        expect(write2).toBeGreaterThan(0);
        // The read from the modified request should be less than the original write,
        // because the system message prefix changed
        expect(read2).toBeLessThan(writeTokens1);

        console.log("Scenario 5:", {
          original_write: writeTokens1,
          modified_write: write2,
          modified_read: read2,
        });
      },
    );

    // ── Scenario 6: Identical request replay (100% cache hit) ────
    // Send the exact same request twice. Second should be a full cache hit.
    test(
      "Scenario 6: Identical request replay gets full cache hit",
      { timeout: 30_000 },
      async () => {
        const api = makeApi();
        const request = {
          model: MODEL,
          messages: [
            { role: "system" as const, content: SYSTEM_MESSAGE },
            {
              role: "user" as const,
              content:
                "List all the database migration files and explain what each one does.",
            },
          ],
          tools: TOOLS,
          max_tokens: 256,
        };

        // First request
        const resp1 = await api.chatCompletionNonStream(request, signal);
        const usage1 = resp1.usage!;
        const details1 = usage1.prompt_tokens_details as any;
        const write1 = details1?.cache_write_tokens ?? 0;

        expect(write1).toBeGreaterThan(0);

        // Identical second request
        const resp2 = await api.chatCompletionNonStream(request, signal);
        const usage2 = resp2.usage!;
        const details2 = usage2.prompt_tokens_details as any;
        const read2 = details2?.cache_read_tokens ?? 0;
        const rate = cacheHitRate(usage2);

        // Should read back approximately what was written
        expect(read2).toBeGreaterThan(0);
        // Hit rate should be very high (>90%) since it's identical
        expect(rate).toBeGreaterThan(0.9);

        console.log("Scenario 6:", {
          first_write: write1,
          second_read: read2,
          hit_rate: rate.toFixed(3),
        });
      },
    );

    // ── Scenario 7: Multi-step tool chain ────────────────────────
    // Simulates: user asks to fix a bug → assistant reads file → assistant
    // runs tests → assistant writes fix. Tests caching across a realistic
    // multi-step agentic workflow with interleaved tool calls.
    test(
      "Scenario 7: Multi-step agentic workflow with chained tool calls",
      { timeout: 60_000 },
      async () => {
        const api = makeApi();

        // Step 1: user reports bug, assistant reads the file
        const messages1: any[] = [
          { role: "system", content: SYSTEM_MESSAGE },
          {
            role: "user",
            content:
              "There's a bug in the team service - when you delete a team, it doesn't clean up the team members. Can you investigate and fix it?",
          },
          {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "tc_step1",
                type: "function",
                function: {
                  name: "read_file",
                  arguments: JSON.stringify({
                    path: "packages/core/src/services/team.service.ts",
                  }),
                },
              },
            ],
          },
          {
            role: "tool",
            tool_call_id: "tc_step1",
            content: [
              "1 | import { db } from '../database';",
              "2 | import { Team } from '../database/models/Team';",
              "3 |",
              "4 | export class TeamService {",
              "5 |   async deleteTeam(teamId: string): Promise<void> {",
              "6 |     await db.teams.delete(teamId);",
              "7 |     // BUG: doesn't clean up team members!",
              "8 |   }",
              "9 | }",
            ].join("\n"),
          },
          {
            role: "user",
            content:
              "I see the file. Can you also check the test file to see if there's a test for this?",
          },
        ];

        const resp1 = await api.chatCompletionNonStream(
          { model: MODEL, messages: messages1, tools: TOOLS, max_tokens: 256 },
          signal,
        );
        const usage1 = resp1.usage!;
        const details1 = usage1.prompt_tokens_details as any;
        expect(details1?.cache_write_tokens).toBeGreaterThan(0);

        // Step 2: assistant reads the test file (builds on step 1's cache)
        const messages2: any[] = [
          ...messages1,
          {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "tc_step2",
                type: "function",
                function: {
                  name: "read_file",
                  arguments: JSON.stringify({
                    path: "packages/core/tests/services.test.ts",
                  }),
                },
              },
            ],
          },
          {
            role: "tool",
            tool_call_id: "tc_step2",
            content: [
              "1 | describe('TeamService', () => {",
              "2 |   it('should create a team', async () => { /* ... */ });",
              "3 |   it('should delete a team', async () => {",
              "4 |     await teamService.deleteTeam('team-1');",
              "5 |     // Only checks team is deleted, not members",
              "6 |     expect(await db.teams.findById('team-1')).toBeNull();",
              "7 |   });",
              "8 | });",
            ].join("\n"),
          },
          {
            role: "user",
            content:
              "Alright, I see the problem. Please write the fix and update the test.",
          },
        ];

        const resp2 = await api.chatCompletionNonStream(
          { model: MODEL, messages: messages2, tools: TOOLS, max_tokens: 256 },
          signal,
        );
        const usage2 = resp2.usage!;
        const rate2 = cacheHitRate(usage2);

        // Step 2 should have a cache hit from step 1's prefix
        expect(usage2.prompt_tokens_details?.cache_read_tokens).toBeGreaterThan(
          0,
        );

        // Step 3: another follow-up (builds further on the cache)
        const messages3: any[] = [
          ...messages2,
          {
            role: "assistant",
            content:
              resp2.choices[0].message.content ??
              "I'll fix the deleteTeam method to also delete team members.",
          },
          {
            role: "user",
            content:
              "Good fix. Now run the tests to make sure everything passes.",
          },
        ];

        const resp3 = await api.chatCompletionNonStream(
          { model: MODEL, messages: messages3, tools: TOOLS, max_tokens: 256 },
          signal,
        );
        const usage3 = resp3.usage!;
        const rate3 = cacheHitRate(usage3);

        expect(usage3.prompt_tokens_details?.cache_read_tokens).toBeGreaterThan(
          0,
        );
        expect(rate3).toBeGreaterThan(0.4);

        console.log("Scenario 7:", {
          step1_write: details1?.cache_write_tokens,
          step2_rate: rate2.toFixed(3),
          step3_rate: rate3.toFixed(3),
        });
      },
    );
  },
);
