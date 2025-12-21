# PR Submission Guide for Continue.dev

## Current Status

✅ **Code Complete:**

- Message normalization implemented in `messageNormalizer.ts`
- Integrated into `streamChatResponse.ts`
- Tested with 8 working models
- Debug logging removed
- Documentation complete

✅ **Git Status:**

- Branch: `feature/ollama-model-message-normalization`
- Commits: 3 total
  - `67ddbbc74` - Initial implementation
  - `c2a708971` - Test results and cleanup
  - `eb73b5c58` - PR documentation
- Remote: `upstream` = continuedev/continue

## Step-by-Step PR Submission

### 1. Create Fork on GitHub (if not exists)

Visit: https://github.com/continuedev/continue

Click "Fork" button → Create fork under `mvara-ai` or your preferred org

### 2. Add Fork as Remote and Push

```bash
cd /Users/mars/Dev/ship-ide/continue

# Add your fork as origin (replace with actual fork URL)
git remote add origin https://github.com/YOUR_ORG/continue.git

# Push the feature branch
git push origin feature/ollama-model-message-normalization
```

### 3. Create Pull Request

1. Go to your fork on GitHub
2. Click "Compare & pull request" for the `feature/ollama-model-message-normalization` branch
3. **Base repository:** `continuedev/continue`
4. **Base branch:** `main`
5. **Head repository:** Your fork
6. **Compare branch:** `feature/ollama-model-message-normalization`

### 4. Fill PR Template

**Title:**

```
Add message normalization for Ollama model compatibility
```

**Description:**
Use content from `PR_DOCUMENTATION.md` - it's already formatted for the PR.

Key sections to include:

- Summary (with "Fixes #9249")
- Problem statement
- Solution overview
- Testing results
- Implementation details
- Checklist

### 5. Sign CLA

Continue.dev requires a Contributor License Agreement (CLA).

When you submit the PR, a bot will comment with CLA signing instructions.

Follow the link and sign the CLA.

### 6. Respond to Review Feedback

Continue.dev maintainers may request:

- Additional tests
- Code style changes
- Documentation updates
- Performance considerations

Be responsive and collaborative.

## Files Changed in PR

```
extensions/cli/src/util/messageNormalizer.ts (NEW)
extensions/cli/src/stream/streamChatResponse.ts (MODIFIED)
```

**Note:** Do NOT include:

- `SHIP_IDE_MODIFICATIONS.md` (Ship-specific)
- `PR_DOCUMENTATION.md` (just for reference)
- `PR_SUBMISSION_GUIDE.md` (this file)
- Package lock files (unless specifically needed)

## Testing Evidence

Include in PR comments if requested:

**Working Models:**

- DeepSeek V3.1 (671B Cloud) ✅
- Qwen3 family (Coder 480B, VL 235B, Next 80B) ✅
- Cogito 2.1 (671B Cloud) ✅
- GLM 4.6, Minimax M2, Kimi K2 ✅

**Known Limitation:**

- Gemma3 (27B Cloud) - `index` field issue ❌

## Alternative: Submit Without Fork

If you prefer not to maintain a fork:

```bash
# Create PR branch from upstream
git checkout -b feature/ollama-model-message-normalization upstream/main

# Cherry-pick our commits
git cherry-pick 67ddbbc74 c2a708971

# Push directly to upstream (if you have permissions)
# OR create a temporary fork just for this PR
```

## Post-PR Actions

After PR is merged:

1. **Update Ship-IDE fork:**

   ```bash
   git checkout main
   git fetch upstream
   git merge upstream/main
   git push origin main
   ```

2. **Clean up branch:**

   ```bash
   git branch -d feature/ollama-model-message-normalization
   git push origin --delete feature/ollama-model-message-normalization
   ```

3. **Update SHIP_IDE_MODIFICATIONS.md:**
   - Note PR number and merge date
   - Mark as "Contributed upstream"

## Contact

If issues arise during PR submission:

- Continue.dev Discord: https://discord.gg/continue
- GitHub Discussions: https://github.com/continuedev/continue/discussions

## Quick Reference

- **GitHub Issue:** #9249
- **PR Branch:** `feature/ollama-model-message-normalization`
- **Upstream Repo:** https://github.com/continuedev/continue
- **Documentation:** `PR_DOCUMENTATION.md`
