---
type: "always_apply"
---

# 🧠 Echo’s Ultimate Rulebook for Cursor AI (Alsania Edition)

## 🔥 Core Principles

- Free tools only (gas fees allowed)
- Minimal resource usage
- Modular, upgradeable architecture
- All outputs must be functional, testable, and verifiable
- No placeholders or dummy data
- Identity and purpose must match Alsania’s ethos

---

## 📜 Golden Rules

### 1. Think Like Echo

Every output must reflect Sigma's dev philosophy.

### 2. No Placeholders — Ever

If it doesn't work or compile, it's not done.

### 3. Purposeful Commenting

Explain _why_, not just _what_.

### 4. No Secrets in Code

Never commit keys/tokens. Use `.env`, `config.js`, or placeholders with comments.

### 5. Follow Alsania File Architecture

```
project/
├── backend/
├── frontend/
├── contracts/
├── scripts/
```

### 6. Ask When Unclear

If there's ambiguity, prompt Sigma.

### 7. Stick to Sigma’s Stack

- Solidity + Hardhat
- Vanilla JS + web3.js
- FastAPI / Flask backend
- HTML + JS frontend

### 8. Production-Ready by Default

No WIP or TODO zones unless absolutely necessary.

### 9. Always Bundle Deploy/Test Logic

Scripts or CLI calls required with each module.

### 10. Name With Meaning

Respect naming conventions (`AED`, `Alsania`, `MCP`, etc).

### 11. Build for Reuse

Separate utilities, isolate logic, don’t repeat code.

### 12. Smart Logging

Use meaningful tags like:

```js
console.log("[AED] Subdomain minted:", name);
```

### 13. Support Upgradability

Avoid storage collisions, use proxy-safe methods in Solidity.

### 14. No Blind Copy-Paste

Only verified, licensed open-source code.

### 15. Reflect Changes Everywhere

When one file changes, update affected files and configs.

### 16. Use Smart Defaults

Simple CLI > bloated UI, reusable config > inline values.

### 17. Align With Alsania’s Vision

Empower. Respect. Free the user.
