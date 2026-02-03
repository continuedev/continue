# Operational Report

**Air-Gapped Continue + Ollama Deployment**

**Author:** Tapiwa Gutu  
**Context:** Java AI Technical Assessment  
**Date:** February 2026

---

## 1. Purpose and Scope

This document describes the **operational design, deployment model, and runtime behavior** of an air-gapped AI coding assistant based on:

- **Continue (VS Code extension)**
- **Ollama (local LLM runtime)**

The primary goal of this work is to demonstrate **secure, offline-capable AI tooling** suitable for **network-restricted or regulated environments**, with an emphasis on:

- Zero external network dependencies at runtime
- Predictable memory behavior
- Reproducible deployment
- Operational simplicity

This document intentionally avoids test-case detail; those are covered in a separate Test Report.

---

## 2. Architectural Overview

### 2.1 High-Level Architecture

The system consists of three primary components:

1. **VS Code Extension (Continue – Air-Gapped Build)**

   - Provides the UI and developer interaction surface
   - Runs entirely locally inside VS Code
   - Communicates only with a local Ollama instance

2. **Ollama Runtime (Dockerized)**

   - Hosts the local LLM
   - Exposes a single HTTP API bound to `127.0.0.1`
   - Runs without update checks or remote model access

3. **Local Host System**
   - Provides CPU, memory, and filesystem
   - No external services required once installed

There are **no cloud dependencies**, **no authentication services**, and **no telemetry endpoints** involved in normal operation.

---

## 3. Air-Gap Enforcement Strategy

Air-gapping is enforced at **multiple layers**, not just configuration.

### 3.1 Codebase Changes

The following classes of functionality were **explicitly removed or disabled**:

- Cloud LLM providers
- Remote inference endpoints
- Build-time and runtime network checks
- Telemetry and error reporting (e.g. Sentry)
- Authentication flows requiring external services

Remaining network call sites in the core codebase were either:

- removed, or
- guarded to ensure localhost-only usage

This ensures that even accidental configuration cannot re-enable outbound traffic.

---

### 3.2 VS Code Extension Behavior

- The extension does **not** require login
- Authentication providers are stubbed or reduced to no-ops
- All model interactions resolve to a **local Ollama endpoint only**
- Marketplace access is not required for operation

Any marketplace-related warnings visible in the VS Code console are **non-functional noise** and do not affect runtime behavior.

---

## 4. Ollama Runtime Configuration

### 4.1 Deployment Model

Ollama is run using **Docker Compose**, built from a locally controlled Dockerfile.

Key design decisions:

- **No model seeding at runtime**
- **No writable model volumes**
- Models are baked directly into the container image
- Startup behavior is deterministic

This approach was chosen after extensive experimentation with:

- Docker volumes on macOS
- OverlayFS limitations
- mmap instability when mixing bind mounts and runtime copying

---

### 4.2 Docker Compose Configuration

Key operational constraints:

- Localhost-only port binding (`127.0.0.1:11434`)
- Explicit CPU and memory limits
- Enlarged `tmpfs` for intermediate allocations
- Single-model, single-context execution

Relevant environment settings:

- `OLLAMA_FORCE_MMAP=1`
- `OLLAMA_NO_UPDATE=1`
- `OLLAMA_NUM_CTX=2048`
- `OLLAMA_MAX_LOADED_MODELS=1`
- `OLLAMA_NUM_PARALLEL=1`
- `OLLAMA_DEBUG=false`

These values were chosen to prioritize **stability over throughput**.

---

## 5. Memory Management and mmap Realities

### 5.1 mmap Constraints on macOS

Through testing, the following realities were established:

- Docker volumes on macOS are implemented using overlay mechanisms
- Ollama **will not reliably use mmap** when models reside on overlay filesystems
- Bind mounts may appear to work initially but fail when runtime mutation occurs

As a result:

- Runtime seeding was abandoned
- Models are embedded directly in the image
- mmap behavior is treated as **best-effort**, not guaranteed

---

### 5.2 OOM Avoidance Strategy

Even with small models, OOM events can occur without mmap.

Mitigations applied:

- Small-to-medium model selection
- Conservative context window (2048 tokens)
- Single active model at a time
- Limited parallelism
- Increased `/tmp` tmpfs size

The system favors **predictable failure modes** over maximum capacity.

---

## 6. Build and Packaging Process

### 6.1 Extension Build

The VS Code extension is built and packaged using the existing Continue toolchain:

- `npm install`
- `prepackage`
- `vsce package`

No custom packaging logic was introduced beyond removing network-dependent behavior.

### 6.2 Offline Suitability

Once built:

- The VSIX can be installed without internet access
- Ollama runs entirely from the local Docker image
- No runtime downloads are required

This supports environments where:

- Docker is available
- Internet access is restricted or fully blocked

---

## 7. Known Runtime Noise and Non-Issues

Certain console messages remain visible but are **non-blocking**:

- VS Code grammar override warnings (Java / Groovy)
- Marketplace metadata fetch failures
- GitHub Copilot authentication failures (from other extensions)
- Deprecation warnings from upstream dependencies

These originate from:

- VS Code itself
- Other installed extensions
- Node.js runtime warnings

They do **not** indicate functional issues with this system.

---

## 8. Operational Limitations

The following limitations are acknowledged and accepted:

- mmap is not guaranteed on macOS
- Very small models can still OOM under constrained memory
- No automatic model switching
- No online updates or downloads
- No cloud fallback

These are deliberate trade-offs to preserve **air-gap integrity**.

---

## 9. Rationale for Technology Choices

### 9.1 Why Continue + Ollama

- Mature local-first tooling
- Transparent architecture
- Easy to audit and modify
- Strong ecosystem support

### 9.2 Why Not Rewrite in Java

The assignment goal is **system design and operational correctness**, not language purity.

Rewriting:

- would not improve air-gap guarantees
- would introduce unnecessary risk
- would delay validation of the core requirement

Java remains relevant at the integration and enterprise boundary, but was not the right tool for this layer.

---

## 10. Conclusion

This implementation demonstrates:

- A fully local AI coding assistant
- Explicit enforcement of air-gapped constraints
- Honest handling of platform limitations
- Stable, reproducible deployment

Most importantly, it demonstrates **engineering judgment** — knowing when to simplify, when to stop, and when to accept real-world constraints.

## Appendix A: Rejected Approaches

This appendix documents approaches that were explicitly evaluated and rejected during the design and implementation of this system, along with the rationale for each decision.

### A.1 Runtime Model Seeding via Docker Volumes

**Description:**  
Mounting a writable Docker volume or bind mount at runtime and pulling or copying models into the container during startup.

**Reason for Rejection:**

- Docker volumes on macOS are implemented using overlay mechanisms
- Ollama does not reliably enable mmap when models reside on overlay filesystems
- Runtime copying introduces nondeterministic startup behavior
- Increased risk of partial or corrupted model state after restarts

**Decision:**  
Abandoned in favor of baking models directly into the container image.

---

### A.2 External Model Registries or Pull-Through Caches

**Description:**  
Using a local registry mirror or proxy to fetch models on demand while appearing “local” to the runtime.

**Reason for Rejection:**

- Violates strict air-gap requirements
- Introduces hidden network dependencies
- Complicates security review and compliance attestation
- Increases operational complexity

**Decision:**  
Rejected to preserve absolute offline guarantees.

---

### A.3 mmap-Only Assumptions

**Description:**  
Designing the system under the assumption that mmap would always be available and reliable.

**Reason for Rejection:**

- mmap behavior varies by host OS and filesystem
- macOS + Docker introduces unpredictable mmap behavior
- Leads to brittle configurations and opaque failures

**Decision:**  
mmap treated as a best-effort optimization, not a hard dependency.

---

### A.4 Large Context Windows and High Parallelism

**Description:**  
Maximizing context length and parallel request handling to improve throughput and model quality.

**Reason for Rejection:**

- Significantly increases peak memory usage
- Leads to frequent OOM conditions without mmap
- Reduces system predictability under constrained resources

**Decision:**  
Adopted conservative defaults prioritizing stability over raw performance.

---

### A.5 Cloud-Based Authentication and Licensing Flows

**Description:**  
Retaining Continue’s default authentication, licensing, or telemetry integrations.

**Reason for Rejection:**

- Requires outbound network access
- Introduces failure modes unrelated to core functionality
- Conflicts with regulated and disconnected environments

**Decision:**  
Authentication providers reduced to no-ops; telemetry fully disabled.

---

### A.6 Full Java Reimplementation

**Description:**  
Rewriting the system entirely in Java to align with the assignment’s language context.

**Reason for Rejection:**

- No improvement to air-gap guarantees
- Increased implementation risk and time
- Distracts from operational and architectural objectives

**Decision:**  
Existing tooling leveraged; focus maintained on system design and operational correctness.
