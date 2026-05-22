---
name: docs-style
description: Style guidelines for writing and updating documentation. Use when writing new docs, updating existing docs, or reviewing docs for quality.
---

# Docs Style Guide

## Principles

- **Be concise** — no filler. Make it easy to find what you're looking for
- **Task-oriented** — frame around what the user is trying to do, not what the product can do
- **Progressive disclosure** — guide from introduction to advanced use-cases. Don't throw users into the deep end
- **Real examples over abstract explanations** — show, don't describe
- **Code snippets must be copy-pasteable** — no placeholder values that silently break, no missing imports
- **Prerequisites up front** — don't surprise the user halfway through
- **One topic per page** — if you're covering two things, split it
- **Link, don't repeat** — reference other docs instead of duplicating content
- **Scannable headings** — skimming the TOC should reveal the page structure
- **Show expected output** — after a step, tell the user what they should see
- **Consistent terminology** — pick one term for a concept, use it everywhere
- **Screenshots/GIFs for key product features** — use visuals when they teach faster than text
- **Know which type of doc you're writing** — a tutorial (learning), a how-to (completing a task), a reference (looking something up), or an explanation (understanding why). Don't mix them in one page
- **Tutorials should be completable** — a user following every step should end up with a working result, every time
- **Reference docs should be exhaustive and consistent** — cover everything, use the same structure for every entry

## Tone

- **Don't be patronizing** — the reader is a developer. Don't tell them when to use something in a "when to use X vs Y" comparison table. If the distinction matters, state it plainly at the top of the relevant section in a sentence, then move on.
- **Respect the reader's time** — open with the command or code, not a paragraph explaining what they're about to see. Lead with the thing, then explain.
- **No personality** — the docs aren't a character. Don't try to be warm, clever, or endearing. No "Let's dive in!", no "The Magic of...", no "Pro Tip:", no emoji in headings. Developers see through it instantly and it reads like marketing copy wearing a docs costume. Just be direct and clinical. The docs serve information, they don't have a relationship with the reader.
- **Inline guidance over callout boxes** — prefer weaving tips into the prose rather than using `<Tip>`, `<Info>`, `<Warning>`, etc. These components break reading flow and look heavy when overused. Reserve them for truly critical warnings (e.g. data loss, security). One per page is a good ceiling; zero is often fine.
- **Examples should feel real** — use realistic file paths, realistic prompts, realistic tasks. Not `> Tell me about the CLI` but `> @tests/auth.test.ts This test started failing after the last migration`.
- **Examples earn their place** — don't add "Example: Doing X" sections that are just English prompts in a code block. Examples are valuable when they demonstrate non-obvious syntax, flags, piping, or configuration. If the reader could figure it out from the rest of the page, skip the example.
- **No "Next Steps" sections** — don't end pages with a "Next Steps" or "What's Next?" section with CardGroups linking to other pages. The sidebar navigation already does this. If a link to another page is relevant, put it inline where the context is, not in a generic footer.
- **Page title = sidebar title** — the `title` in frontmatter should match the sidebar label. Drop `sidebarTitle` unless there's a genuine reason for them to differ. Don't stuff extra context into the page title (e.g., "Continue CLI (cn) Overview" → "Overview").
- **No subtitle/description in frontmatter** — don't use the `description` field. The opening paragraph of the page should provide whatever context is needed. Metadata subtitles add clutter and duplicate what the prose already says.

## Headings

- **Direct and plain, not clever or engaging** — headings should just say what the section is about. Verbs are fine when they're direct ("Resume previous sessions"). Gerund phrases that sound like tutorial chapter titles are not ("Giving Context with @" → "`@` Context"). The test isn't grammatical — it's tonal. If it sounds like a friendly narrator is walking you through something, rewrite it. If it just plainly states what the section covers, it's good.
- **Scannable over descriptive** — skimming the TOC should reveal the page structure at a glance. Keep headings short and plain.
