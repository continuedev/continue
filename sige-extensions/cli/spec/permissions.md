# Permissions

## Permission types

To make sure that users can oversee the actions of the LLM, we implement a permissions system. Every tool has one of the following permissions:

- `allow`: The tool will be automatically called without asking
- `ask`: We will ask the user before calling the tool, giving them the options to accept or reject
- `exclude`: This tool will be completely excluded, so the model won't even know it exists

## Rule precedence

There is a default set of permissions for the builtin tools in [`src/permissions/defaultPolicies.ts`](../src/permissions/defaultPolicies.ts). But these policies can be overriden by multiple layers. The order of precedence is as follows, which the earlier items taking precedence:

1. **Mode policies** (highest priority - see [modes.md](./modes.md))
2. Command line flags (`--allow`, `--ask`, `--exclude`)
3. Permissions in `config.yaml` / configuration
4. Permissions in `~/.continue/permissions.yaml`
5. Default policies

**Note:** Mode policies **completely override all other permission settings** in plan and auto modes. Available modes:

- `normal`: No mode policies (uses existing configuration)
- `plan`: **Absolute override** - excludes all write tools, allows only read tools (ignores user config)
- `auto`: **Absolute override** - allows all tools without asking (ignores user config)

## Tool matching patterns

We use a tool matching pattern to match tools to permissions. This format looks like the following:

- `Read` matches any call to the `Read` tool
- `Read(*)` also matches any call to the `Read` tool
- `Read(**/*.ts)` matches any call to the `Read` tool where the primary parameter matches the glob pattern `**/*.ts`.

Note that for an `exclude` policy, it doesn't make sense to have argument matching.

## Command line flags

Each of the `--allow`, `--ask`, and `--exclude` flags allow you to set the permission for a tool. Usage must be a "tool matching pattern" as described above for each flag, with each providing a policy that will be added to the list of policies in order.

```bash
# Allow Read, Ask Write, and Exclude Bash
cn --allow Read --ask Write --exclude Bash

# Start in plan mode (read-only tools only)
cn --readonly "Help me understand this codebase"

# Use mode switching during chat
cn "Let me work on this feature"  # Starts in normal mode
# Then use Shift+Tab to cycle through modes
```

## `config.yaml` / Configuration (implement later)

::: info
This should not be implemented yet.
:::

To let users define their permissions as a part of their custom assistant, they can do so in the permissions section of `config.yaml` or their configuration:

```yaml
permissions:
  allow:
    - Read(*)

  ask:
    - Write(**/*.py)

  exclude:
    - Write
```

## `~/.continue/permissions.yaml` (personal settings)

It would be frustrating for users to have to set the same permissions across all of their assistants, so we provide them a file for personal settings. It should be basically equivalent to the `permissions` section of `config.yaml`:

```yaml title="~/.continue/permissions.yaml"
allow:
  - Read(*)

ask:
  - Write(**/*.py)

exclude:
  - Write
```

Except that it's important to understand that this file is _not_ intended to be edited by the user. It is only for persistence, and users should interact with their permissions by using the TUI.

This file should be created the first time that the CLI starts.

## Headless mode permissions

When running in headless mode (using the `-p` or `--print` flag), the CLI uses the same default policies as normal mode, but with different behavior for tools that require confirmation:

- **Normal mode**: Write operations and terminal commands require confirmation (`ask`) - user is prompted
- **Headless mode**: Same default policies, but tools requiring confirmation (`ask`) will cause the process to exit with an error message

To use tools that normally require confirmation in headless mode, you must explicitly allow them:

```bash
# Headless mode with explicit permissions for write operations
cn -p --allow write_file "Write a hello world script"

# Headless mode with wildcard permission (allow all tools)
cn -p --allow "*" "Write and run a script"

# Headless mode with specific restrictions
cn -p --exclude run_terminal_command "Clean up the codebase"
```

This approach ensures that headless mode is secure by default while providing clear guidance on how to enable the needed permissions.
