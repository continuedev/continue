---
name: ruckus-browser
description: Explore and debug a web application with available browser tools or Playwright, inspect controls, exercise interactions, and capture screenshots when supported.
---

# Browser verification in Ruckus IDE

Inspect the repository's package scripts, existing browser tests, and development
server configuration first. Use the project's existing Playwright setup when
available. Start its development server with the terminal tool if needed.

1. If browser automation tools are available through a configured MCP server, use
   those tools to navigate the local application and inspect accessible controls.
2. Otherwise run the repository's browser tests with the terminal tool. Use existing
   test configuration and browser dependencies. If none exist, explain what setup
   is missing before proposing to install it.
3. Reproduce interactions using role/name, label, text, or test ID selectors. Check
   the result and inspect console errors rather than assuming a click succeeded.
4. Capture desktop or mobile screenshots through the available tooling when visual
   verification is useful. Only claim to have inspected an image when you actually
   viewed it with an available image-capable tool.
5. Report the exact commands, exit statuses, observed failures, and remaining gaps.
   Browser exploration alone does not prove all acceptance criteria pass.

Do not assume the IDE has a browser tool just because this skill is installed.
This extension does not provide the separate Ruckus Builder tools `browse_project`,
`verify_project`, `review_project`, or `finish_project`. Use the actual tools exposed
in this session, and preserve normal terminal/tool approval policies.
