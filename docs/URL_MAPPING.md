# URL Mapping for Documentation Restructuring

This document tracks all URL changes from the old structure to the new 5-section structure.

## Core Features Redirects

### Chat
- `/chat/how-to-use-it` → `/features/chat/quick-start`
- `/chat/how-it-works` → `/features/chat/how-it-works`
- `/chat/how-to-customize` → `/customization/chat`
- `/chat/context-selection` → `/advanced/context-integration/chat-context`
- `/chat/model-setup` → `/customization/models`

### Autocomplete
- `/autocomplete/how-to-use-it` → `/features/autocomplete/quick-start`
- `/autocomplete/how-it-works` → `/features/autocomplete/how-it-works`
- `/autocomplete/how-to-customize` → `/customization/autocomplete`
- `/autocomplete/context-selection` → `/advanced/context-integration/autocomplete-context`
- `/autocomplete/model-setup` → `/customization/models`

### Edit
- `/edit/how-to-use-it` → `/features/edit/quick-start`
- `/edit/how-it-works` → `/features/edit/how-it-works`
- `/edit/how-to-customize` → `/customization/edit`
- `/edit/context-selection` → `/advanced/context-integration/edit-context`
- `/edit/model-setup` → `/customization/models`

### Agent
- `/agent/how-to-use-it` → `/features/agent/quick-start`
- `/agent/how-it-works` → `/features/agent/how-it-works`
- `/agent/how-to-customize` → `/customization/agent`
- `/agent/context-selection` → `/advanced/context-integration/agent-context`
- `/agent/model-setup` → `/customization/models`

## Blocks → Multiple Sections
- `/blocks/context-providers` → `/advanced/context-integration/custom-providers`
- `/blocks/data` → `/advanced/deep-dives/data-blocks`
- `/blocks/docs` → `/advanced/context-integration/documentation`
- `/blocks/mcp` → `/customization/blocks/mcp-tools`
- `/blocks/models` → `/customization/models`
- `/blocks/prompts` → `/customization/blocks/prompts`
- `/blocks/rules` → `/customization/rules`

## Customization Redirects
- `/customize/overview` → `/customization/overview`
- `/customize/context-providers` → `/advanced/context-integration/custom-providers`
- `/customize/model-providers/*` → `/advanced/model-providers/*`
- `/customize/model-roles/*` → `/advanced/model-roles/*`
- `/customize/deep-dives/*` → `/advanced/deep-dives/*`
- `/customize/tutorials/*` → `/advanced/tutorials/*`

### Deep Dives
- `/customize/deep-dives/autocomplete` → `/advanced/deep-dives/autocomplete`
- `/customize/deep-dives/codebase` → `/advanced/context-integration/codebase`
- `/customize/deep-dives/configuration` → `/advanced/deep-dives/configuration`
- `/customize/deep-dives/development-data` → `/advanced/deep-dives/development-data`
- `/customize/deep-dives/docs` → `/advanced/context-integration/documentation`
- `/customize/deep-dives/mcp` → `/customization/blocks/mcp-tools`
- `/customize/deep-dives/prompts` → `/customization/blocks/prompts`
- `/customize/deep-dives/rules` → `/customization/rules`
- `/customize/deep-dives/settings` → `/advanced/deep-dives/settings`
- `/customize/deep-dives/slash-commands` → `/advanced/context-integration/slash-commands`
- `/customize/deep-dives/vscode-actions` → `/advanced/deep-dives/vscode-actions`

## Hub Redirects
- `/hub/introduction` → `/hub/overview`
- `/hub/assistants/intro` → `/hub/featured-assistants`
- `/hub/assistants/use-an-assistant` → `/hub/using-assistants`
- `/hub/assistants/create-an-assistant` → `/hub/publishing`
- `/hub/assistants/edit-an-assistant` → `/hub/publishing`
- `/hub/blocks/*` → `/customization/blocks`
- `/hub/governance/*` → `/hub/community`
- `/hub/source-control` → `/hub/publishing`

## Other Redirects
- `/telemetry` → `/advanced/telemetry`
- `/troubleshooting` → `/advanced/troubleshooting`
- `/reference` → `/advanced/reference`
- `/json-reference` → `/advanced/reference`
- `/yaml-migration` → `/advanced/yaml-migration`

## No Change (Keep as-is)
- `/` (introduction)
- `/getting-started/install`
- `/getting-started/overview`

## Netlify Redirect Format
Each mapping above should be converted to:
```toml
[[redirects]]
  from = "[old-path]"
  to = "[new-path]"
  status = 301
```

## Notes
1. All redirects should use 301 (permanent) status
2. Test all redirects on staging before production
3. Monitor 404 errors after deployment
4. Update this document if any new mappings are discovered