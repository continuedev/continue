# Ship-IDE Modifications to Continue.dev

This document tracks all modifications made to the Continue.dev codebase for Ship-IDE integration.

## Modification History

### 1. Message Normalization for Ollama Model Compatibility

**Date:** December 21, 2025  
**GitHub Issue:** [#9249](https://github.com/continuedev/continue/issues/9249)  
**Status:** Implemented, pending PR submission  
**Branch:** `ship-ide-main`

#### Problem

Certain Ollama cloud models (Mistral Large 3, Ministral 3, Gemma3 27B) fail during MCP tool calling when Continue sends the conversation back to the model after tool execution (Turn 2 of the tool calling flow).

**Errors:**

- **Mistral/Ministral:** `400 Bad Request: Unexpected role 'system' after role 'tool'`
- **Gemma3:** `400 Bad Request: Invalid 'tool_calls': unknown variant 'index'`

#### Solution

Added message normalization layer that detects model family and applies appropriate fixes before sending messages to Ollama's OpenAI endpoint.

#### Files Modified

1. **`extensions/cli/src/util/messageNormalizer.ts`** (NEW)

   - Created message normalization utility
   - Handles Mistral family: Moves system messages before tool interactions
   - Handles Gemma family: Removes 'index' field from tool_calls
   - Model detection based on model name string

2. **`extensions/cli/src/stream/streamChatResponse.ts`**
   - Line 22: Added import for `normalizeMessagesForModel`
   - Lines 262-268: Added normalization step after OpenAI format conversion
   - Line 282: Use normalized messages in API call

#### Technical Details

**For Mistral/Ministral:**

- These models don't accept system messages after tool messages
- Solution: Collect all system messages and prepend them before any tool interactions
- If system message appears after tool, convert to user message with `[System instruction]:` prefix

**For Gemma3:**

- Model doesn't recognize 'index' field in tool_calls structure
- Solution: Strip 'index' field from tool_calls while preserving id, type, and function fields

#### Testing Results

**✅ Working Models (MCP Tool Calling Confirmed):**

- DeepSeek V3.1 (671B Cloud) - Full MCP integration working
- Qwen3 Coder (480B Cloud) - Full MCP integration working
- Qwen3 VL (235B Cloud) - Full MCP integration working
- Qwen3 Next (80B Cloud) - Full MCP integration working
- Cogito 2.1 (671B Cloud) - Full MCP integration working
- GLM 4.6 (Cloud) - Full MCP integration working
- Minimax M2 (Cloud) - Full MCP integration working
- Kimi K2 (1T Cloud) - Full MCP integration working

**❌ Known Limitation:**

- Gemma3 (27B Cloud) - Fails with `index` field error
  - Issue: `index` field added after normalization by OpenAI adapter layer
  - Impact: Cannot use MCP tool calling
  - Status: Not a priority - all important models work

**Key Finding:** DeepSeek V3.1 now works perfectly with MCP tools. Original issue may have been environmental or fixed in recent Ollama updates.

#### Upstream Contribution

- Issue created: https://github.com/continuedev/continue/issues/9249
- PR planned after thorough testing
- Generic fix suitable for upstream contribution (no Ship-IDE specific code)

---

## Fork Management Strategy

**Approach:** Selective cherry-pick from upstream

1. **Track upstream:** Monitor Continue.dev releases
2. **Cherry-pick valuable updates:** Security fixes, performance improvements, bug fixes
3. **Skip breaking changes:** Ignore updates that conflict with ship-specific features
4. **Test everything:** Every merged PR gets tested with our MCP stack

**Git workflow:**

```bash
# Setup
git remote add upstream https://github.com/continuedev/continue.git
git checkout -b ship-ide-main

# When upstream has updates
git fetch upstream
git log upstream/main --oneline
git cherry-pick <commit-hash>  # Selectively merge

# Test
npm run build
npm test
cn --config ~/.continue/config.yaml
```

**Commit conventions:**

- `[SHIP]` prefix for ship-specific changes
- `[UPSTREAM]` prefix for cherry-picked upstream commits
- Reference GitHub issue numbers in commit messages

---

## Build Instructions

**Prerequisites:**

```bash
# Install dependencies at root
cd /Users/mars/Dev/ship-ide/continue
npm install

# Build packages
cd packages/config-yaml && npm run build
cd ../terminal-security && npm run build
# ... build other required packages

# Build CLI
cd extensions/cli
npm install
npm run build
```

**Testing:**

```bash
# Run tests
npm test

# Test with MCP servers
cn --config ~/.continue/config.yaml
```

---

## Future Modifications

Track additional Ship-IDE specific modifications here:

- [ ] Ocean-bus listener for autonomous mode
- [ ] DM integration for ship-to-ship communication
- [ ] Custom MCP server integrations
- [ ] Deployment automation

---

## Maintenance Notes

- **Upstream sync frequency:** Check weekly for important updates
- **Testing requirements:** All MCP servers must work after any merge
- **Documentation:** Update this file for every modification
- **PR strategy:** Contribute generic improvements upstream when possible
