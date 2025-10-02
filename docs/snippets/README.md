# Cookbook Snippets

This directory contains reusable Mintlify snippets for cookbook setup sections, designed to make it easy to maintain consistency across cookbook documentation.

## Available Snippets

### Core Setup Snippets

- **`cookbook-what-youll-learn.mdx`** - Standard "What You'll Learn" section
- **`cookbook-prerequisites.mdx`** - Standard "Prerequisites" section
- **`cookbook-workflow-options.mdx`** - Standard workflow options (Quick Start vs Manual)
- **`cookbook-setup-steps.mdx`** - Common setup steps for Continue CLI
- **`cookbook-manual-setup.mdx`** - Manual setup tab content

### Variable Components

- **`cookbook-learning-points.mdx`** - Learning points list with variables
- **`cookbook-prerequisite-list.mdx`** - Prerequisites list with variables

## Usage

### Basic Usage

```mdx
<Snippet
  file="cookbook-what-youll-learn.mdx"
  variables={{
    tool_name: "PostHog MCP",
    primary_function: "query analytics, errors, and feature flags",
    skill_1: "Analyze user behavior patterns with AI",
    skill_2: "Automatically create GitHub issues using GitHub CLI",
    skill_3: "Set up continuous monitoring with GitHub Actions",
  }}
/>
```

### Available Variables

#### For `cookbook-learning-points.mdx`:

- `tool_name` - The main tool/MCP name
- `primary_function` - What the tool does
- `skill_1`, `skill_2`, `skill_3` - Specific skills learned

#### For `cookbook-prerequisite-list.mdx`:

- `primary_requirement` - Main requirement (e.g., "GitHub repository")
- `service_account` - Required service account (e.g., "PostHog account")
- `service_plan` - Plan type (e.g., "free tier")
- `additional_tool` - Additional tool needed
- `installation_command` - Installation command for additional tool
- `setup_step_title` - Title for custom setup step
- `setup_step_content` - Content for custom setup step

#### For `cookbook-workflow-options.mdx`:

- `service_name` - Service name (e.g., "PostHog")
- `service_type` - Service type (e.g., "Analytics")
- `additional_features` - Additional agent features
- `quick_start_instruction` - Quick start instructions
- `task_type` - Type of task (e.g., "Analysis")
- `first_task_instruction` - First task instructions
- `agent_benefits` - Benefits of using the agent
- `service_functionality` - What the service does
- `mcp_hub_url` - Hub URL for the MCP
- `mcp_install_command` - MCP install command
- `mcp_installation_details` - Installation details
- `mcp_auth_info` - Authentication information

#### For `cookbook-manual-setup.mdx`:

- `service_name` - Service name
- `mcp_hub_url` - MCP Hub URL
- `mcp_install_command` - MCP install command
- `mcp_installation_details` - Installation details
- `mcp_auth_info` - Authentication info
- `manual_setup_step_title` - Manual setup step title
- `manual_setup_step_content` - Manual setup step content
- `manual_setup_additional_info` - Additional setup information
- `task_type` - Task type
- `manual_first_task` - Manual first task instructions

## Example Implementation

See `docs/guides/posthog-github-continuous-ai.mdx` for a complete example of how these snippets are used with variables.

## Benefits

1. **Consistency** - All cookbooks use the same structure and wording
2. **Maintainability** - Change once, update everywhere
3. **Flexibility** - Variables allow customization while maintaining structure
4. **Efficiency** - No need to copy/paste setup sections

## Adding New Variables

To add new variables:

1. Update the snippet file to include the new variable placeholder: `{{variable_name}}`
2. Update this README with the new variable
3. Update any cookbooks using the snippet to include the new variable value

## Testing

To test snippets locally:

1. Build the docs: `cd docs && npm run build`
2. Check for any variable resolution errors
3. Verify the rendered content looks correct
