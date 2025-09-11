---
globs: docs/\*_/_.{md,mdx}
description: This style guide should be used as a reference for maintaining consistency across all Continue documentation
alwaysApply: false
---

# Continue Documentation Style Guide

## Overview

## Writing Tone & Voice

### Conversational and Direct

- Follow Mintlify documentation standards
- Use simple, conversational language that gets straight to the point
- Avoid overly technical jargon when simpler terms work
- Write as if speaking directly to the developer using the tool
- Keep paragraphs concise and scannable

**Example:**
✅ "You send it a question, and it replies with an answer"
❌ "The system processes user queries and generates corresponding responses"

### Helpful and Instructional

- Focus on helping users accomplish their goals
- Use active voice and imperative mood for instructions
- Assume users want to get things done quickly
- Include relevant Admonition components for tips, warnings, and info

**Example:**
✅ "Press cmd/ctrl + L to begin a new session"
❌ "A new session can be initiated by pressing cmd/ctrl + L"

### Practical and Task-Oriented

- Emphasize what users can accomplish with each feature
- Lead with benefits and use cases before diving into mechanics
- Keep explanations grounded in real-world scenarios

## Content Structure

### Page Organization

1. **Visual Introduction**: Lead with GIFs or images showing the feature in action
2. **Purpose Statement**: Brief explanation of what the feature does and when to use it
3. **Step-by-Step Instructions**: Clear, actionable steps with keyboard shortcuts
4. **Platform-Specific Notes**: Separate sections for VS Code and JetBrains when needed
5. **Additional Tips**: Advanced usage or troubleshooting notes

### Section Headers

- Use consistent heading hierarchy starting with h2 (##)
- Include YAML frontmatter with title, description, and keywords
- Use action-oriented headers that describe what users will do
- Format: "Verb + object" (e.g., "Type a request and press enter")
- Keep headers concise but descriptive
- Use title case

**Examples:**
✅ "Highlight code and activate"
✅ "Accept or reject changes"
✅ "Switch between different models"

### Lists and Steps

- Use numbered lists for sequential steps
- Use bullet points for feature lists or options
- Keep list items parallel in structure
- Start action items with verbs

## Technical Writing Standards

### Code and Keyboard Shortcuts

- Use `backticks` for inline code elements
- Format keyboard shortcuts consistently: `cmd/ctrl + L`
- Always provide shortcuts for Mac/Windows/Linux
- Use code blocks for configuration examples with proper syntax highlighting

### Cross-References

- Link to related sections using descriptive anchor text
- Use relative links to other documentation pages
- Format: `[descriptive text](/path/to/page)`

### Platform Differences

- Always address both VS Code and JetBrains when applicable
- Use clear subheadings to separate platform-specific instructions
- Lead with the more common platform (typically VS Code) when both are covered

## Language Conventions

### Terminology

- **Consistent Terms**: Use the same terms throughout (e.g., "LLM" not "AI model" in some places)
- **Product Names**: Capitalize product names correctly (VS Code, JetBrains, Continue)
- **Feature Names**: Use consistent capitalization for Continue features (Chat, Edit, Agent, Autocomplete)

### Abbreviations

- Spell out acronyms on first use, then use abbreviation consistently
- Common abbreviations: LLM, IDE, API, URL

### Pronouns

- Use "you" to address the user directly
- Use "it" to refer to the tool/model
- Avoid "we" unless referring to the Continue team
