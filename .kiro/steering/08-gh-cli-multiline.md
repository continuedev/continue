---
inclusion: auto
---

# GitHub CLI — Multiline Body / Comment

## Problem

`gh pr comment --body "..."` và `gh pr create --body "..."` bị lỗi `dquote>` khi body chứa newlines hoặc ký tự đặc biệt trong shell.

## Rule: LUÔN dùng heredoc hoặc file cho multiline body

### ✅ ĐÚNG — Dùng heredoc (stdin)

```bash
gh pr comment 13131 --repo continuedev/continue --body-file - <<'EOF'
Hi maintainers,

The failing check appears unrelated to this change.

Thanks!
EOF
```

### ✅ ĐÚNG — Dùng temp file

```bash
cat > /tmp/pr-body.md <<'EOF'
Hi maintainers,

The failing check appears unrelated to this change.

Thanks!
EOF
gh pr comment 13131 --repo continuedev/continue --body-file /tmp/pr-body.md
```

### ❌ SAI — Multiline string trong --body

```bash
# KHÔNG LÀM THẾ NÀY — sẽ bị dquote> error
gh pr comment 13131 --body "Line 1
Line 2
Line 3"
```

## Áp dụng cho tất cả gh commands có body:

- `gh pr create --body-file`
- `gh pr comment --body-file`
- `gh issue create --body-file`
- `gh issue comment --body-file`
