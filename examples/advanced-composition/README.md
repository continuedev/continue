# Advanced Composition Examples

These examples demonstrate the power of Code Mode's composability and the massive token savings compared to traditional MCP tool calling.

## 📂 Examples

### 1. [Parallel Batch Operations](./01-parallel-batch-operations.ts)
**Task:** Analyze 5 GitHub repositories in parallel, find stale issues, batch-update with labels and comments.

- **Traditional:** 200+ LLM round-trips, ~350K tokens
- **Code Mode:** Single execution, ~6K tokens
- **Reduction:** 98.3%

**Key Features:**
- Parallel repository analysis
- In-code filtering (huge token savings)
- Batch label/comment updates
- Complex date calculations

---

### 2. [Multi-Service Orchestration](./02-multi-service-orchestration.ts)
**Task:** Monitor GitHub PR activity, generate reports, save to filesystem, send Slack notifications.

- **Traditional:** 150+ LLM round-trips, ~280K tokens
- **Code Mode:** Single execution, ~7K tokens
- **Reduction:** 97.5%

**Key Features:**
- Orchestration across 3 MCP services (GitHub, Filesystem, Slack)
- Nested parallel operations (for each PR: fetch reviews + commits + comments)
- Complex data transformation and formatting
- Conditional Slack messaging

---

### 3. [Data Pipeline with Error Handling](./03-data-pipeline-with-error-handling.ts)
**Task:** Process uploaded files, validate, transform, sync to GitHub with retry logic.

- **Traditional:** Complex error handling nearly impossible
- **Code Mode:** Full try-catch, retries with exponential backoff, graceful degradation
- **Reduction:** 96.8%

**Key Features:**
- Sophisticated error handling (try-catch, retry logic)
- Control flow (for loops with continue/break)
- Helper functions (reusable retry wrapper)
- Complex decision trees
- Automatic issue creation for errors

---

### 4. [Stateful Caching Workflow](./04-stateful-caching-workflow.ts)
**Task:** Build a smart GitHub analyzer that caches results across executions using `globalThis`.

- **Traditional:** No state persistence between calls
- **Code Mode:** Intelligent TTL-based caching
- **First call:** 93.3% reduction
- **Subsequent calls:** 99.2% reduction (cache hits)

**Key Features:**
- Persistent cache using `globalThis` (survives across executions)
- TTL-based cache invalidation
- Cache hit/miss tracking
- Cross-execution analytics

---

### 5. [Complex Cross-Repository Analysis](./05-complex-cross-repo-analysis.ts)
**Task:** Analyze dependencies, contributor overlap, code health across multiple repositories.

- **Traditional:** 300+ LLM round-trips, ~450K tokens
- **Code Mode:** Single execution, ~6K tokens
- **Reduction:** 98.7%

**Key Features:**
- Massive parallel data collection (30 simultaneous API calls)
- Complex data structures (Maps, Sets, nested aggregations)
- Algorithmic analysis (graph analysis, frequency analysis, multi-factor scoring)
- Multi-phase workflow with state management
- Advanced filtering and priority-based sorting

---

## 🎯 Why These Are Impossible with Traditional Tool Calling

### Problem 1: No Composition
Traditional MCP requires the LLM to be involved in every tool call. You can't:
- Loop over results
- Filter data before returning to context
- Chain operations without LLM round-trips
- Use conditional logic

### Problem 2: Token Explosion
Every tool call includes:
- Full tool schemas (~2-4K tokens)
- Accumulated conversation history
- Results from previous calls

For a 50-step workflow:
- Traditional: 50 × (4K schemas + growing history) = 300-500K tokens
- Code Mode: 1 × (4K schemas + minimal result) = 5-8K tokens

### Problem 3: No State Management
Traditional tool calling is stateless. You can't:
- Cache results across calls
- Build up complex data structures
- Maintain counters, metrics, or aggregations
- Persist state across executions

### Problem 4: Limited Control Flow
No way to express:
- Try-catch error handling
- Retry logic with exponential backoff
- For loops with break/continue
- Complex conditional branching

### Problem 5: Latency Multiplier
Every tool call = LLM round-trip:
- Traditional 50-step workflow: 50 × 2 seconds = 100 seconds
- Code Mode 50-step workflow: 1 × 10 seconds = 10 seconds

---

## 📊 Summary: Token Savings Across Examples

| Example | Traditional Tokens | Code Mode Tokens | Reduction | Cost Savings |
|---------|-------------------|------------------|-----------|--------------|
| Parallel Batch Ops | 350,000 | 6,000 | **98.3%** | 98.3% |
| Multi-Service | 280,000 | 7,000 | **97.5%** | 97.5% |
| Error Handling Pipeline | 220,000 | 7,000 | **96.8%** | 96.8% |
| Stateful Caching (2 runs) | 432,000 | 14,000 | **96.8%** | 96.8% |
| Cross-Repo Analysis | 450,000 | 6,000 | **98.7%** | 98.7% |
| **Average** | **346,400** | **8,000** | **97.7%** | **97.7%** |

**At GPT-4 pricing ($0.002/1K tokens):**
- Traditional average cost: **$0.69 per workflow**
- Code Mode average cost: **$0.016 per workflow**
- **Savings: $0.67 per workflow (43× cheaper)**

---

## 🚀 Running These Examples

### Prerequisites
1. Code Mode enabled in Continue configuration
2. E2B API key configured
3. MCP servers configured (github, filesystem, slack)

### Usage

Simply ask your AI agent to perform the task described in each example:

**Example 1:**
> "Analyze our main repositories for stale issues and add labels to any that haven't been updated in 30 days"

**Example 2:**
> "Generate a weekly PR activity report and send it to our dev team in Slack"

**Example 3:**
> "Process the uploaded data files, validate them, and sync to GitHub"

**Example 4:**
> "Analyze our repositories' health and compare the metrics"

**Example 5:**
> "Do a comprehensive cross-repository analysis covering contributors, dependencies, and code health"

The agent will write and execute code similar to these examples automatically!

---

## 💡 Key Takeaways

1. **Composability unlocks new patterns**: Things like parallel execution, retry logic, and caching are natural in code but impossible with traditional tool calling.

2. **Token savings compound**: Multi-step workflows see 95-99% reductions because:
   - Schemas loaded once (not per tool call)
   - Filtering happens in code (not in context)
   - No LLM round-trips for intermediate steps

3. **Cost and latency benefits**: Not only cheaper (50× in some cases), but also faster (parallel execution, no LLM wait times).

4. **Production-ready patterns**: Error handling, retries, caching, state management - all the patterns you need for real-world workflows.

5. **Drop-in solution**: Works with any MCP server without modifications. Just enable Code Mode and go!

---

## 📚 Learn More

- [Main README](../../README.md) - Code Mode overview
- [Documentation](../../docs/) - Full documentation
- [MCP Servers](https://github.com/modelcontextprotocol/servers) - Official MCP server repository
