# Ruckus IDE: Gateway and Agent Skills

This fork retains Continue's IDE and agent loop and uses Vercel AI Gateway as its
only registered model provider. The VS Code onboarding and model form are Gateway-only.
The shared core changes also apply to JetBrains, but JetBrains packaging and the
separate CLI are not acceptance targets for this change.

## Connect

Open the extension and select **Connect Vercel AI Gateway**. Supply a Gateway API
key, not an OpenAI or Anthropic key. This writes starter chat/edit/apply/summarize/
subagent, autocomplete, and embedding models into the local Continue config.
Connecting removes legacy provider model entries; it preserves other configuration.
Existing Gateway models are preserved and starter model credentials are updated.

Keys entered in the UI are saved in `~/.continue/config.yaml`, following the existing
extension storage convention. For a file-based secret instead, place
`AI_GATEWAY_API_KEY=...` in `~/.continue/.env`, and use
`apiKey: ${{ secrets.AI_GATEWAY_API_KEY }}` in YAML. An `AI_GATEWAY_API_KEY`
environment variable inherited by the extension host is also supported when `apiKey`
is omitted. Never commit a real key to a project config.

Example configuration:

```yaml
name: Ruckus IDE
version: 1.0.0
schema: v1
models:
  - name: Claude Sonnet (Gateway)
    provider: vercel-ai-gateway
    model: anthropic/claude-sonnet-4.6
    apiKey: ${{ secrets.AI_GATEWAY_API_KEY }}
    roles: [chat, edit, apply, summarize, subagent]
    capabilities: [tool_use, image_input]
    defaultCompletionOptions:
      contextLength: 200000
      maxTokens: 8192
  - name: Autocomplete (Gateway)
    provider: vercel-ai-gateway
    model: openai/gpt-4.1-mini
    apiKey: ${{ secrets.AI_GATEWAY_API_KEY }}
    roles: [autocomplete]
    defaultCompletionOptions:
      maxTokens: 256
  - name: Embeddings (Gateway)
    provider: vercel-ai-gateway
    model: openai/text-embedding-3-small
    apiKey: ${{ secrets.AI_GATEWAY_API_KEY }}
    roles: [embed]
  # Optional, billed separately when used:
  - name: Rerank (Gateway)
    provider: vercel-ai-gateway
    model: cohere/rerank-v3.5
    apiKey: ${{ secrets.AI_GATEWAY_API_KEY }}
    roles: [rerank]
```

Use **Add Gateway chat model → Load available models** for the live language-model
catalog. Embedding and reranking models are excluded from that chat picker.
Model IDs include the publisher prefix and must match Gateway's catalog.

All configured model roles use `https://ai-gateway.vercel.sh`. Custom `apiBase`
endpoints, direct providers, local model providers, and custom model implementations
are rejected by the IDE config paths. Missing or invalid credentials do not trigger
provider fallback. Retained upstream provider source files are not registered in
the IDE model factory. This is an inference routing policy, not a network firewall:
MCP servers, URL tools, and user-approved shell commands still use their own network
connections.

Autocomplete uses a chat prompt containing the code prefix and suffix. It does not
use `/completions` or `/fim/completions`; latency and quality will differ from a
specialized local FIM model. Embeddings and optional reranking are also billed to
Gateway. Without a configured embedding model, indexing has no local model fallback.
Changing embedding models requires rebuilding existing indexes.

## Skills

The VS Code extension ships the 54 skills in [`skillstoadd`](../../skillstoadd/README.md).
They are available in every project after rebuilding/installing the extension.
The extension build generates its own `bundled-skills` directory, so no project
or home-directory installation is needed. Try “Use $diagnosing-bugs to investigate
this error” in Agent mode. Skills with `disable-model-invocation: true` are marked
manual-only in the catalog. Skills can reference optional tools and external CLIs;
shipping their instructions does not install those dependencies.

Place each skill in a directory containing `SKILL.md`, for example:

```text
.agents/skills/code-review/
  SKILL.md
  references/checklist.md
  scripts/check.sh
```

Copy `examples/skills/code-review` into your project's `.agents/skills/` to try it.
In Agent mode, ask “Use $code-review to review these changes.” The model sees skill
names/descriptions and calls `read_skill` to load instructions. Supporting files are
listed with absolute URIs and read on demand with the existing file tool. Script
execution uses the normal terminal tool and its approval policy. `allowed-tools`
metadata does not bypass those policies.

Discovery order (first matching name wins):

1. Each workspace root, in IDE order: `.continue/skills`, `.agents/skills`,
   `.claude/skills`, `.codex/skills`.
2. User roots: `~/.continue/skills` (or `CONTINUE_GLOBAL_DIR/skills`),
   `~/.agents/skills`, `~/.claude/skills`, `~/.codex/skills`.
3. The installed VS Code extension’s `bundled-skills/` directory.

The user roots are on the core/extension host. Project paths retain their URI scheme
for remote workspaces. A remote host may not expose skills installed on the local
machine; install them on that host or in the project.

Names and descriptions follow the Agent Skills format, including a name matching
its containing directory. Optional license, compatibility, metadata, and
allowed-tools fields are accepted. Invalid files and shadowed names produce config
warnings without disabling other skills. Discovery is bounded to six directory
levels and 2,000 directories; resource listings are capped at 500 files. Symlinked
skill directories are supported with bounded traversal. Resources are not executed
on discovery. Project `SKILL.md` changes trigger config reload; reload the extension
window after installing or changing user-global skills.

## Verification

```sh
# Install using the repository's supported Node version (.nvmrc).
npm ci
CI=true node scripts/build-packages.js
cd core && PUPPETEER_SKIP_DOWNLOAD=true npm ci && npm run tsc:check
npm run vitest -- config/markdown/loadMarkdownSkills.vitest.ts llm/llms/VercelAIGateway.vitest.ts
cd ../packages/openai-adapters && npm test -- --run src/test/VercelAIGateway.test.ts
cd ../../gui && npm ci && npm run build
npm test -- src/forms/AddModelForm.test.tsx
```

The Gateway adapter tests mock HTTP, including tool-call streaming, usage, cancellation,
errors, completions, embeddings, catalog loading, and reranking. They do not prove
live paid model behavior. A release still needs an extension-host smoke test using
a real Gateway key: chat → skill read → file tool → edit; cancel a streamed response;
exercise autocomplete and indexing; confirm requests in the Gateway dashboard.

References: [Gateway APIs](https://vercel.com/docs/ai-gateway/sdks-and-apis/openai-chat-completions),
[reranking](https://vercel.com/docs/ai-gateway/sdks-and-apis/cohere-rerank),
[Agent Skills specification](https://agentskills.io/specification).
