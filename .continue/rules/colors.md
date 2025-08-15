---
name: Extension Color Themes
description: Guidelines for using theme colors in GUI components
alwaysApply: false
globs: "gui/**/*.tsx"
---

When adding colors to components, use tailwind color classes.
Do NOT use explicit colors like text-gray-400. Instead, use theme colors.

## Available theme colors

### Normal text

- `foreground`, `description`, `description-muted`

### Other text, icons, etc

- `success`, `warning`, `error`, `accent`, `link`

### General components

- `background`, `border`, `border-focus`

### Specific components

#### Button

- `primary`, `primary-foreground`, `primary-hover`
- `secondary`, `secondary-foreground`, `secondary-hover`

#### Input

- `input`, `input-foreground`, `input-border`, `input-placeholder`

#### Badge

- `badge`, `badge-foreground`

#### List/Dropdown items

- `list-hover`, `list-active`, `list-active-foreground`

#### Code Editor

- `editor`, `editor-foreground`

## Usage examples

Any of these colors can be used in tailwind classes:

- `bg-primary`
- `text-success`
- `border-error`
- `hover:bg-list-hover`

## Excluded colors

The following less-used colors are excluded from this guide:

- Command (only used by tip-tap): `command`, `command-foreground`, `command-border`, `command-border-focus`
- Find widget colors: `find-match`, `find-match-selected`
- `table-oddRow`
