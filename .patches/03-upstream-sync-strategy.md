# Upstream Sync Strategy — Keeping Custom Continue Updated

## Overview

Strategy để maintain custom Continue extension fork khi upstream `continuedev/continue` release updates, phục vụ ~300+ developer users.

> **Cập nhật 2026-08-09**: Đã migrate từ `main` (base v2.0.0) sang git-flow pattern với `develop` + `release/v2.1.x-onprem`.

---

## 1. Git Workflow

### Repository Setup

```bash
cd /mnt/e/08-Sources/1.AI/continue  # WSL path

# Remotes
git remote -v
# origin   → https://github.com/thanhnnict/continue (fork)
# upstream → https://github.com/continuedev/continue (read-only)
```

### Branch Strategy (Git-Flow)

```
upstream/main                  ← tracking upstream continuedev/continue
      │
      ▼
  develop                      ← làm việc chính — upstream/main + custom patches
      │                           phát triển features cho khách hàng
      │                           KHÔNG push force trừ khi rebase upstream
      ▼
release/v2.1.x-onprem          ← stable snapshot — build VSIX deploy
      │                           merge từ develop khi stable
      ▼
   [VSIX build]                ← deploy cho ~300 developers
```

**Các branch PR lên upstream (tạo từ upstream/main, không từ develop):**

```
upstream/main
  ├── fix/empty-response-retry        → PR #13091 (OPEN)
  ├── fix/sanitize-tool-arguments     → PR #13092 (OPEN)
  └── feat/always-on-context-usage    → PR #13093 (OPEN)
```

**Branch `main`**: Giữ làm archive của custom build v2.0.x (base `release/v2.0.0-vscode`). Không dùng làm working branch nữa.

> **Lưu ý**: `git checkout main` sẽ báo warning `refname 'main' is ambiguous` do trùng tên với tag upstream.
> Dùng `git checkout refs/heads/main` hoặc `git push origin refs/heads/main:refs/heads/main` khi cần.

---

## 2. Sync Process (khi upstream có commits mới)

### Step 1: Fetch upstream

```bash
cd /mnt/e/08-Sources/1.AI/continue
git fetch upstream refs/heads/main:refs/remotes/upstream/main

# Xem có gì mới
git log --oneline upstream/main -10

# Xem có bao nhiêu commit mới so với develop
git log --oneline develop..upstream/main | wc -l
```

### Step 2: Kiểm tra conflict trước khi rebase

```bash
# Test rebase không commit — xem có conflict không
git checkout develop
git rebase --no-commit upstream/main 2>&1 | head -20

# Kiểm tra conflict trong các file đã patch
CONFLICTS=$(git diff --name-only --diff-filter=U 2>/dev/null)
if echo "$CONFLICTS" | grep -qE "OpenAI\.ts|openaiTypeConverters\.ts|visionProxy\.ts|extension\.ts"; then
  echo "⚠️  CONFLICT in patched files — manual resolution needed"
  echo "$CONFLICTS"
  git rebase --abort
else
  echo "✅ No conflicts in patched files"
  git rebase --abort
fi
```

### Step 3: Rebase develop lên upstream/main

```bash
git checkout develop
git rebase upstream/main

# Nếu conflict:
# 1. Resolve manually trong file conflict
# 2. git add <file>
# 3. git rebase --continue
# Nếu muốn skip commit: git rebase --skip

# Push develop (force-with-lease vì history thay đổi sau rebase)
git push origin develop --force-with-lease
```

**Resolve conflict thường gặp:**

```bash
# extensions/vscode/package.json — version conflict
# Luôn giữ version theo scheme: {upstream_major}.{upstream_minor}.{custom_patch}
# Ví dụ: upstream v2.1.0 → custom version "2.1.1"
```

### Step 4: Verify patches còn hoạt động

```bash
# Patch 01 — NIM empty response retry
grep -c "retry.*without.*tools\|tool_calls.*length.*0" \
  packages/openai-adapters/src/apis/OpenAI.ts
# Expected: >= 1

# Patch 02 — JSON sanitize
grep -c "sanitize\|JSON\.parse.*arguments" \
  core/llm/openaiTypeConverters.ts
# Expected: >= 1

# Patch 03 — Vision proxy
ls core/llm/visionProxy.ts
# Expected: file exists

# Patch 04 — TLS / insecure option
grep -c "rejectUnauthorized\|NODE_TLS_REJECT" \
  packages/fetch/src/getAgentOptions.ts
# Expected: >= 1

# Build test
conda run -n node20 bash -c 'cd packages/openai-adapters && npm run build 2>&1 | tail -3'
conda run -n node20 bash -c 'cd core && npm run build 2>&1 | tail -3'
```

### Step 5: Merge vào release

```bash
git checkout release/v2.1.x-onprem
git merge develop
git push origin release/v2.1.x-onprem

# Tag nếu là release chính thức
git tag v2.1.1
git push origin v2.1.1
```

### Step 6: Build VSIX

```bash
# Trên WSL (linux-x64) hoặc target platform
conda run -n node20 bash -c '
  cd packages/openai-adapters && npm run build && cd ../.. &&
  cd core && npm run build && cd .. &&
  cd gui && npm run build && cd .. &&
  cd extensions/vscode && npm run prepackage -- --target linux-x64 &&
  npm run package -- --target linux-x64
'
# Output: extensions/vscode/build/continue-linux-x64-2.1.1.vsix
```

---

## 3. Khi upstream release version mới (vd: v2.2.0)

```bash
# 1. Fetch
git fetch upstream refs/heads/main:refs/remotes/upstream/main

# 2. Rebase develop
git checkout develop
git rebase upstream/main
# Resolve version conflict → đặt "2.2.1" trong package.json

# 3. Rename release branch (hoặc tạo mới)
git checkout release/v2.1.x-onprem
git branch -m release/v2.2.x-onprem
git push origin release/v2.2.x-onprem
git push origin --delete release/v2.1.x-onprem  # xóa branch cũ nếu muốn

# 4. Merge develop → release mới
git merge develop
git push origin release/v2.2.x-onprem
```

---

## 4. When Patches Become Unnecessary

### Patch 01 — NIM Empty Response Retry (`packages/openai-adapters/src/apis/OpenAI.ts`)

**Remove when:**
- PR #13091 merged vào upstream → upstream tự xử lý
- NIM/vLLM servers fix behavior (trả content thay vì null khi không call tool)

```bash
# Kiểm tra upstream đã có chưa
grep -r "retry.*without.*tools" packages/openai-adapters/src/
```

### Patch 02 — JSON Sanitize (`core/llm/openaiTypeConverters.ts`)

**Remove when:**
- PR #13092 merged vào upstream
- vLLM fix issue #43995 (không strict validate tool_calls arguments trong history)

```bash
grep -r "sanitize.*args\|JSON\.parse.*arguments" core/llm/
```

### Patch 03 — Vision Proxy (`core/llm/visionProxy.ts`)

**Remove when:**
- PR #13093 (context usage) merged — partially related
- Upstream adds native vision proxy support

### Patch 04 — TLS / Insecure (`packages/fetch/src/getAgentOptions.ts`, `extensions/vscode/src/extension.ts`)

**Keep indefinitely** — đặc thù môi trường on-prem với self-signed certs.

---

## 5. Automated Sync Check

```bash
#!/bin/bash
# Chạy hàng tuần để check upstream có commits mới không

cd /mnt/e/08-Sources/1.AI/continue
git fetch upstream refs/heads/main:refs/remotes/upstream/main 2>/dev/null

BEHIND=$(git rev-list develop..upstream/main --count)

if [ "$BEHIND" -gt 0 ]; then
  echo "⚠️  develop is behind upstream/main by $BEHIND commits"
  echo "Latest upstream:"
  git log upstream/main -3 --oneline
  echo ""
  echo "Run: git checkout develop && git rebase upstream/main"
else
  echo "✅ develop is up to date with upstream/main"
fi

# Check PR status
echo ""
echo "=== PR Status ==="
gh pr list --repo continuedev/continue --author thanhnnict --state open \
  --json number,title,state 2>/dev/null
```

---

## 6. Multi-Platform Build

### Kết luận: Build phải chạy trên đúng target OS

Native modules (`onnxruntime-node`, `@lancedb/vectordb`, `@vscode/ripgrep`) được copy trực tiếp từ `node_modules` của host → không thể cross-compile.

| Build host | Target | Result |
|---|---|---|
| macOS arm64 | `darwin-arm64` | ✅ |
| Windows x64 | `win32-x64` | ✅ |
| Linux x64 (WSL) | `linux-x64` | ✅ |
| Linux x64 | `darwin-arm64` | ❌ — native modules sai platform |

**Build command (WSL/Linux):**

```bash
conda run -n node20 bash -c '
  cd packages/openai-adapters && npm run build && cd ../.. &&
  cd core && npm run build && cd .. &&
  cd gui && npm run build && cd .. &&
  cd extensions/vscode &&
  npm run prepackage -- --target linux-x64 &&
  npm run package -- --target linux-x64
'
```

---

## 7. Versioning

### Scheme: `{upstream_major}.{upstream_minor}.{custom_patch}`

| Version | Nghĩa |
|---------|-------|
| `2.1.0` | Rebased lên upstream v2.1.0 (chưa custom patch) |
| `2.1.1` | Custom build #1 sau rebase — hiện tại (develop HEAD) |
| `2.1.2` | Custom build #2 — feature tiếp theo |
| `2.2.1` | Sau khi sync upstream v2.2.0 |

**Quy tắc:**
1. Mỗi lần build có thay đổi code → tăng PATCH +1
2. Sync upstream major/minor mới → reset PATCH về 1 (vd `2.2.1`)
3. Tag git mỗi release chính thức: `git tag v2.1.1`

**`extensions/vscode/package.json`:**

```json
{
  "version": "2.1.1",
  "displayName": "Continue OnPrem",
  "description": "Custom build: Vision Proxy, NIM/vLLM fixes, TLS self-signed, context usage (based on upstream v2.1.0)"
}
```

---

## 8. Decision Matrix: When to Sync

| Upstream Change | Action | Priority |
|---|---|---|
| Security fix | Sync ngay | 🔴 High |
| Bug fix trong patched files | Sync sớm, test kỹ | 🔴 High |
| Bug fix core LLM logic | Sync sớm | 🟡 Medium |
| New model support | Sync khi cần | 🟢 Low |
| UI/UX changes | Sync thuận tiện | 🟢 Low |
| Breaking refactor patched files | Plan migration | 🔴 High |

---

## 9. Contribution Back to Upstream

PR đã tạo (2026-08-09):

| PR | Branch | File | Status |
|----|--------|------|--------|
| [#13091](https://github.com/continuedev/continue/pull/13091) | `fix/empty-response-retry` | `OpenAI.ts` | OPEN |
| [#13092](https://github.com/continuedev/continue/pull/13092) | `fix/sanitize-tool-arguments` | `openaiTypeConverters.ts` | OPEN |
| [#13093](https://github.com/continuedev/continue/pull/13093) | `feat/always-on-context-usage` | GUI components | OPEN |

**Tạo PR mới:**

```bash
# Luôn tạo branch từ upstream/main — KHÔNG từ develop
git fetch upstream refs/heads/main:refs/remotes/upstream/main
git checkout -b fix/ten-van-de upstream/main

# Code, commit, push
git push -u origin fix/ten-van-de

# Tạo PR
gh pr create \
  --repo continuedev/continue \
  --title "fix: mô tả ngắn" \
  --body "..." \
  --base main
```

Xem chi tiết: `.patches/07-huong-dan-dong-gop-pr-cong-dong.md`
