# Codebase index and code intelligence: what exists, who uses it, how it becomes useful

Written 2026-11-09. Roadmap: Track L in [`ROADMAP.md`](./ROADMAP.md). Source: `research-codebase-index.md` in the session notes folder (file:line for every claim below, read at `main` 600151297), the VS Code commands reference and language-server guide, and the published evaluations listed in section 2. Nothing in this plan is built.

## 1. Problem

The repository carries a complete local code index and almost nothing reads it. A fresh install indexes nothing at all; when a person does turn it on, only the chat `@` providers reach it, the agent is never told it exists, the CLI never builds it, JetBrains and the CLI have no type awareness, and nothing can be shared with a team. The owner's question was how `core/continueServer/`, the index and VS Code's language servers relate, whether any of it is well implemented, and how an index could serve a team. The short answers:

- `core/continueServer/` is not a server. It is a contract plus a thin HTTP client (`IContinueServerClient`, `stubs/client.ts`) for a hub cache endpoint that was never open-sourced. It is constructed in one place from the `remoteConfigServerUrl` and `userToken` settings, and the only caller asks it for the cheapest artifact (chunks), never embeddings. Even against a live server it would save milliseconds of local CPU per file.
- The index itself is four local artifacts under `~/.continuous/index/`: tree-sitter chunks, an SQLite FTS5 trigram table, a `code_snippets` table of definitions with signatures, and one LanceDB vector table per workspace folder, branch and embedding model. It is content-addressed by sha256 with a `(directory, branch, artifact)` tag, so a second branch or worktree of the same repository is a re-tag, not a recompute. The incremental design is sound and integration-tested.
- Three facts explain "nothing uses it". Nothing is built unless an embeddings model is selected, even the FTS and snippet tables that need none. Nothing is built unless a context provider that declares `dependsOnIndexing` is configured, and `@codebase` is not a default provider. The two agent tools that read it (`codebase`, `view_repo_map`) exist only behind `experimental.enableExperimentalTools` and ask for permission. With default settings an Agent turn reads the index zero times; `grep_search` and `file_glob_search` go to ripgrep through the IDE, `read_file` reads the disk, and the CLI's `searchCode` shells out to `rg`.
- Type awareness and the index are separate systems. The IDE protocol exposes `gotoDefinition`, `gotoTypeDefinition`, `getReferences`, `getDocumentSymbols`, `getWorkspaceSymbols`, `getSignatureHelp` and `getProblems`; VS Code implements them with the `vscode.execute*Provider` commands, which fan out to every installed language extension, so this fork needs no language server of its own there. The `code_navigation` tool (#346) already gives the agent symbols, outline, definition, type definition, references and problems in VS Code. JetBrains throws `NotImplementedError` for all five navigation methods and the CLI's `FileSystemIde` returns empty results, so the tool is hidden on both.

### 1.1 Defects to fix before building on it

Found by reading, not by running; the first row of the track confirms each with a test.

| Defect                                                                                                                                                                                    | Where                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| No index at all without an embed model; nothing without an indexing provider                                                                                                              | `core/indexing/CodebaseIndexer.ts` `getIndexesToBuild`, `handleConfigUpdate`   |
| Index order follows provider order with no dependency sort; `codebase` alone very likely builds FTS before the chunks it reads, marks the files complete and never revisits them          | `CodebaseIndexer.ts` `getIndexesToBuild`; `FullTextSearchCodebaseIndex.update` |
| No secondary index on `chunks(cacheKey, path)` or `lance_db_cache(cacheKey)`: per-file lookups scan (the shape of upstream #4255, whose `chunk_tags` fix is present)                      | `chunk/ChunkCodebaseIndex.ts`, `LanceDbIndex.ts`                               |
| Branch lookup raced against 500 ms falls back to the tag `"NONE"`, which matches nothing, so both FTS and vector retrieval return empty on a slow git extension                           | `core/context/retrieval/retrieval.ts`                                          |
| FTS `retrieve` ignores its `directory` argument; `@folder` is enforced only by the pipeline's post-filter                                                                                 | `FullTextSearchCodebaseIndex.ts`                                               |
| Paths interpolated unescaped into SQL `LIKE` and LanceDB filters; repo-map signatures have no tag filter, so other branches leak in                                                       | `LanceDbIndex.ts`, `CodeSnippetsIndex.ts` `getPathsAndSignatures`              |
| Repo-map file selection runs only for model titles containing `claude-3`, `gpt-4`, `llama3.1`, `llama3.2` or `gemini-2.5`: dead for every current model                                   | `core/context/retrieval/repoMapRequest.ts`                                     |
| Vectors stored twice (JSON in SQLite and LanceDB); file text stored five or more times across tables                                                                                      | `LanceDbIndex.ts`, `ChunkCodebaseIndex.ts`, FTS, `CodeSnippetsIndex.ts`        |
| A file saved while indexing is paused is never re-indexed (FIXME); a `(d+)` regex meant to match a LanceDB length error matches the letter d; `if (!continueServerClient)` can never fire | `CodebaseIndexer.ts`                                                           |
| Retrieval has no tests: neither pipeline, `retrieveContextItemsFromEmbeddings` nor `repoMapRequest`; `LanceDbIndex.test.skip.ts` is skipped; the README's known-problems section is stale | `core/context/retrieval/`, `core/indexing/`                                    |
| The `codebase` tool promises semantic search even where LanceDB cannot load (older Linux CPUs), then silently runs FTS only                                                               | `core/tools/definitions/codebaseTool.ts`, `BaseRetrievalPipeline.ts`           |

## 2. What the evidence says

Read 2026-11-08; sources and dates are in the research note.

- **Structural beats dense, for agents.** The one within-harness ablation on a real benchmark (arXiv 2606.22417, June 2026) found a structural index with call edges lifted multi-file task resolution from 41.9 to 50.4 percent and localisation acc@5 from 44 to 85 percent, but held only a non-significant edge over a good grep-driven agent. The turbopuffer Claude Code test put the bottleneck in the model's policy for when to call the tool, not in the retriever.
- **The vendors with the best embedding data walked away from client-side vector indexes.** Cursor measured +12.5 percent offline and +0.3 to 2.6 percent online for embeddings (November 2025) and switched local repositories to a grep-first design in 2026. Sourcegraph Cody, Zed, Claude Code and Codex use no client vector index. The embedding indexes that survive are server-side where the platform already holds the code (GitHub, Sourcegraph, Augment).
- **Sharing exists only where a server has identity.** Sourcegraph (SCIP uploads), GitHub's remote index, Cursor's Merkle-proof index copies and Augment's GitHub App. Every surviving code-index MCP server (Zilliz claude-context, Serena, code-index-mcp, the Sourcegraph and GitHub servers) offers search and symbol tools beside grep, never instead of it.
- **Aider's repo map** (tree-sitter tags ranked by PageRank over references, budgeted to the context) is the cheapest structural artifact with a measured effect; ours lists signatures by position with no ranking.

For this fork the conclusion is: a structural index plus the language servers is the measured win; embeddings are a layer behind a reranker for teams that have one; and whatever is built must ship with prompt guidance and a benchmark scenario or it will sit unused like the current index.

## 3. Design

### 3.1 The agent's instruments

Three tools the model is told about, in this order of preference in the act and plan turn text (`core/llm/prompts/turns.ts`): `code_navigation` for "where is X defined, who calls X, what type is X, is this file clean"; `search_codebase` for finding code by meaning or by name across the repository; `grep_search` for strings, configuration keys and anything the language server does not know. Read before claiming, as today.

- **`code_navigation`, completed.** Add `hover` (type and documentation of an expression, through `vscode.executeHoverProvider`), `implementations` (`executeImplementationProvider`), `callers` and `callees` (`prepareCallHierarchy`, `provideIncomingCalls`, `provideOutgoingCalls`) and `signature` (`getSignatureHelp`, already in the protocol). Each needs a protocol message in `core/protocol/ide.ts` and `core/index.d.ts`, the VS Code implementation in `VsCodeIde.ts`, and a stub in `core/util/filesystem.ts`.
- **`search_codebase`**, replacing the experimental `codebase` tool. Parameters `query`, optional `directory`, optional `kind` (`text`, `symbol`, `semantic`, `all`). Runs the FTS trigram query and a phrase query, a title lookup over `code_snippets`, and `LanceDbIndex.retrieve` only when an embed model is selected; merges with reciprocal rank fusion, reranks when a reranker exists, caps at a token budget, and returns ranked snippets with path and lines. Registered whenever indexing is enabled and at least one artifact exists, read-only policy, no experimental flag. The fusion function is extracted so the chat pipelines use the same one.
- **`view_repo_map`** gains `directory` and `maxTokens`, ranks files by reference count (title occurrences in other files' chunks, through FTS) and drops low-ranked files instead of truncating from the top. The model-title allowlist in `repoMapRequest.ts` goes; a config flag gates the file-selection step.
- **Symbols without a language server.** `outline` and `find_symbol` served from `code_snippets` where `code_navigation` is hidden (JetBrains until L5, the CLI until L6), presented as the same tool with a `source: tree-sitter` note so the model knows the answer is approximate.

### 3.2 The index builds whether or not embeddings exist

FTS and snippets build whenever `disableIndexing` is false, regardless of the embed model and of which providers are configured; LanceDB builds only with an embed model. The index order is sorted by dependency (chunks before FTS, chunks before embeddings). The CLI constructs the indexer for `cn` and `cn serve` once L6 gives it somewhere to show progress; until then `search_codebase` in the CLI reads an index built by the IDE or by `cn index build`.

### 3.3 Type awareness on the other surfaces

- **JetBrains**: implement the five `NotImplementedError` methods in `IntelliJIde.kt` with PSI (`PsiReference`, `ReferencesSearch`, `GotoSymbolContributor`), add `getWorkspaceSymbols` to `MessageTypes.kt`, and register `code_navigation` for `ideType === "jetbrains"`. PSI is richer than LSP; the gap is the Kotlin side, not the protocol.
- **CLI**: an `LspService` with a config map of language servers (`typescript-language-server --stdio`, `pyright-langserver --stdio`, `rust-analyzer`, `gopls`, `clangd`, `jdtls`) started lazily on the first request for a file of that language, speaking JSON-RPC over stdio (`initialize`, `didOpen` on demand, `definition`, `typeDefinition`, `references`, `documentSymbol`, `workspace/symbol`, `hover`, `signatureHelp`, `publishDiagnostics` collected into `getProblems`). It implements the existing `IDE` methods in the CLI's IDE object so `code_navigation` registers with no tool change, in headless runs, `cn serve` and the benchmark. The servers are not bundled: the CLI detects them and says what to install. Serena's `SolidLSP` (MIT, Python) is the reference for the per-language quirks.

### 3.4 A shared index for a team

Three shapes were compared.

| Shape                                                    | Builds                                                                                                   | Fresh                                                                                                             | Who can use it                                                                         | Verdict                                                                                                                             |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| (a) Implement the `IContinueServerClient` cache server   | one client indexes and uploads by content hash (upload is new; the interface is read-only)               | automatic, keys are content hashes                                                                                | this fork, CLI and JetBrains through the shared core                                   | cheapest, least useful: saves embedding compute only, no search surface, couples the team to one embedding model, our protocol only |
| (b) An MCP server over the same SQLite and LanceDB files | `cn index build --commit <sha>` by one machine or CI; per-commit deltas from the content-addressed cache | keyed by commit; a client on a dirty tree overlays its local changes (the recently-edited overlay already exists) | this fork, the CLI, JetBrains, Claude Code, Cursor, Codex, anything with an MCP client | the right shape; what Sourcegraph, Augment, Zilliz and the GitHub MCP server converged on                                           |
| (c) SCIP export                                          | `scip-typescript`, `scip-python`, `rust-analyzer scip`, `scip-java` in CI                                | per commit, by the indexers' incremental modes                                                                    | Sourcegraph, or (b) with a SCIP reader                                                 | an input format to (b) for compiler-accurate definitions and references; not the primary architecture                               |

The server (b) exposes tools `search_text`, `find_symbol`, `outline`, `repo_map`, `semantic_search` (optional), `references_lexical`, and resources `index://{repo}/{commit}/manifest` and `index://{repo}/{commit}/files`. Auth is the MCP transport's: this fork already does OAuth for streamable-http and sse. On a cache miss the client falls back to local grep and tree-sitter, or triggers a build. A `cn index pull` fetches the nearest ancestor commit for a working tree. The `continueServer` stub and its two settings are removed when the server lands; nothing else reads them.

### 3.5 Measuring it

The benchmark (`bench/`, Track I) scores tool-call compliance on a three-file seed, which cannot show a retrieval effect. A "large repo" scenario group uses a pinned public repository of 2,000 to 5,000 files (or a vendored slim copy) and tasks of the form "find where X is validated and add a check for Y" whose answers touch three or more files, with checks `tool-used` (`code_navigation` or `search_codebase`), `files-located` against the known answer set, and the existing cost fields; each scenario runs with and without the tools registered. Metrics copied from the literature: localisation acc@5, resolve rate, dollars per solved task. A timing fixture on the same repository records index build time, disk size and per-query latency before and after the L1 fixes.

### 3.6 Not in scope

- Hosting Sourcegraph, or building a code-search web UI.
- Cross-repository search; the server serves one repository per index.
- Replacing ripgrep. `grep_search` stays, and the prompt tells the model what each tool is for.
- Changing the embedding model or the chunker; the embeddings layer is optional and unchanged.

## 4. Decisions and assumptions

| Decision                                        | Default used for planning                                                                                       | Open |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---- |
| Fate of `core/continueServer/`                  | delete it with L7, since no server exists and the MCP server supersedes it; the two VS Code settings go with it | yes  |
| Team index shape                                | (b), an MCP server built per commit; (c) SCIP as an ingest format where an indexer exists                       | no   |
| Which copy of the vector is the source of truth | LanceDB; the JSON copy in SQLite goes, unless the L1 measurement shows the `addTag` path needs it               | yes  |
| Where the CLI gets type awareness               | a generic LSP client (L6) rather than tree-sitter alone; tree-sitter symbols serve as the fallback              | no   |
| Default policy for `search_codebase`            | allowed without permission, as a read-only tool, in every mode                                                  | no   |
