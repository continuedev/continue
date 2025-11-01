---
globs: core/llm/llms/**/*.{ts,test.ts}
description: Tailor recommendations for LLM code based on which specific LLM is being used.
---

# LLM Model Specificity

- Refer to the file name and names of big classes to determine which LLM is being used in a file.
- Ground all observations and recommendations with knowledge of that LLM.
- Consider items such as context length, architecture, speed, and such.
- Pay attention to the parent classes in these files.
