# Attribution

This document provides detailed attribution for Code Mode and its dependencies.

---

## Code Mode Enhancements

**Copyright © 2024 Connor Belez**

Code Mode introduces novel capabilities to the Continue.dev framework, specifically:

### Original Contributions by Connor Belez

1. **MCP TypeScript Wrapper Generation System**
   - Automatic conversion of JSON Schema to TypeScript types
   - Dynamic code generation for MCP tool bindings
   - Progressive disclosure via virtual filesystem (`/mcp/*`)
   - Location: `core/tools/implementations/executeCode.ts` (McpWrapperGenerator class)

2. **E2B Sandbox Integration**
   - Secure code execution environment
   - Sandbox lifecycle management
   - Bridge bootstrapping for MCP communication
   - Location: `core/tools/implementations/executeCode.ts`

3. **File-based IPC Protocol**
   - Request/response coordination between sandbox and host
   - MCP tool invocation via `globalThis.__mcp_invoke`
   - Polling mechanism with timeout handling
   - Location: `core/tools/implementations/executeCode.ts` (McpRequestMonitor class)

4. **Benchmark Methodology**
   - Token usage analysis framework
   - Cost comparison methodology
   - Performance measurement guidelines
   - Location: `README.md`, `examples/advanced-composition/`

5. **Advanced Composition Examples**
   - 5 production-ready example workflows
   - Detailed token reduction analysis
   - Real-world use case demonstrations
   - Location: `examples/advanced-composition/`

---

## Continue.dev Framework

**Copyright © 2023-2024 Continue Dev, Inc.**
**License:** Apache License 2.0

Code Mode is built on the Continue.dev extension framework, which provides:

- IDE extension infrastructure (VS Code, JetBrains)
- LLM integration and conversation management
- Configuration system
- MCP client implementation and connection management
- UI components and user interface

**Repository:** https://github.com/continuedev/continue
**License File:** [Continue.dev LICENSE](https://github.com/continuedev/continue/blob/main/LICENSE)

### Continue.dev Components Used

- `core/context/mcp/MCPConnection.ts` - MCP client and server connection management
- `extensions/cli/src/services/MCPService.ts` - CLI-specific MCP integration
- Extension framework and IDE integration layer
- Configuration loading and management
- LLM provider abstractions

---

## Third-Party Dependencies

Code Mode relies on several open-source libraries:

### Model Context Protocol SDK
**Copyright © 2024 Anthropic PBC**
**License:** MIT License
**Repository:** https://github.com/modelcontextprotocol/typescript-sdk

Provides:
- MCP client implementation
- Transport layer (STDIO, SSE, HTTP, WebSocket)
- Protocol definitions and types

### E2B Code Interpreter
**Copyright © E2B**
**License:** Apache License 2.0
**Repository:** https://github.com/e2b-dev/code-interpreter

Provides:
- Secure sandboxed execution environment
- Firecracker-based microVMs
- File system access APIs

### TypeScript
**Copyright © Microsoft Corporation**
**License:** Apache License 2.0
**Repository:** https://github.com/microsoft/TypeScript

### Node.js and npm packages
Various dependencies as listed in `package.json` files throughout the repository, each with their respective licenses.

---

## Research & Inspiration

Code Mode's approach is inspired by research and articles from:

### Anthropic Research
**"Code Execution with Model Context Protocol"**
https://www.anthropic.com/engineering/code-execution-with-mcp

Key concepts:
- Code execution as a more efficient tool calling mechanism
- Reduction in token usage through code-based workflows

### Cloudflare Blog
**"Code Mode" by Kenton Varda and Sunil Pai**
https://blog.cloudflare.com/code-mode/

Key concepts:
- Articulation of "Code Mode" as a paradigm
- Benefits of code-based AI interactions over JSON schemas

---

## License Compliance

### Apache License 2.0 Requirements

Code Mode complies with the Apache 2.0 license by:

1. ✅ **Preserving copyright notices** - All original Continue.dev copyright notices remain intact
2. ✅ **Including license text** - Apache 2.0 license included in LICENSE file
3. ✅ **Stating changes** - This ATTRIBUTION.md clearly documents Code Mode enhancements
4. ✅ **Including NOTICE** - Attribution provided for all third-party code
5. ✅ **Same license** - Code Mode is distributed under Apache 2.0

### Modifications to Continue.dev Code

The following Continue.dev files have been modified or extended:

- `core/tools/implementations/executeCode.ts` - Added MCP wrapper generation, E2B integration, IPC protocol
- `README.md` - Completely rewritten to focus on Code Mode capabilities
- Various configuration files - Updated for Code Mode branding

All modifications are clearly documented and comply with Apache 2.0 Section 4(b) regarding notices of modifications.

---

## How to Attribute

When referencing Code Mode in your work:

### Academic/Research Citation
```
Belez, C. (2024). Code Mode: 98% Token Reduction for AI Agent Workflows.
GitHub repository: https://github.com/Connorbelez/codeMode
Built on Continue.dev framework (Continue Dev, Inc.)
```

### In Code/Documentation
```
Code Mode by Connor Belez
https://github.com/Connorbelez/codeMode
Based on Continue.dev (Apache 2.0)
```

### Social Media
```
Code Mode by @connorbelez - 98% token reduction for AI agents
Built on @continuedev
```

---

## Questions

For questions about attribution or licensing:
- Open an issue: https://github.com/Connorbelez/codeMode/issues
- Email: [Your contact email if you want to add it]

---

**Last Updated:** November 2024
