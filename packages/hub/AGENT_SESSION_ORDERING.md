# Agent Session Ordering

This document describes the canonical ordering for agent session categories in the Continue Hub kanban board view.

## Overview

The Continue Hub displays agent sessions in a kanban board interface that allows grouping by different categories. This module provides constants and utility functions to ensure consistent ordering across these categories.

## Group By Options

The kanban board supports the following grouping options:

### 1. PR Status

Order: **No PR → Draft → Open → Merged → Closed**

Unknown PR status values should appear after the defined statuses, sorted alphabetically.

### 2. Agent Status

Order: **Planning → Working → Blocked → Done**

Unknown agent status values should appear after the defined statuses, sorted alphabetically.

### 3. Creator

Order: **Alphabetical**

All creator names should be sorted alphabetically.

### 4. Repository

Order: **Alphabetical**

All repository names should be sorted alphabetically.

## Usage

### TypeScript/JavaScript

```typescript
import {
  PR_STATUS_ORDER,
  AGENT_STATUS_ORDER,
  comparePRStatus,
  compareAgentStatus,
  compareAlphabetical,
  getComparator,
  type AgentSessionGroupBy,
} from "@continuedev/hub";

// Sort PR statuses
const prStatuses = ["Closed", "No PR", "Open", "Draft", "Merged", "Unknown"];
const sortedPR = prStatuses.sort(comparePRStatus);
// Result: ['No PR', 'Draft', 'Open', 'Merged', 'Closed', 'Unknown']

// Sort agent statuses
const agentStatuses = ["Done", "Planning", "Blocked", "Working", "Unknown"];
const sortedAgent = agentStatuses.sort(compareAgentStatus);
// Result: ['Planning', 'Working', 'Blocked', 'Done', 'Unknown']

// Sort alphabetically (for Creator or Repository)
const creators = ["Zebra", "Alice", "Bob"];
const sortedCreators = creators.sort(compareAlphabetical);
// Result: ['Alice', 'Bob', 'Zebra']

// Get the appropriate comparator based on grouping
const groupBy: AgentSessionGroupBy = "PR Status";
const comparator = getComparator(groupBy);
const categories = ["Closed", "Draft", "Open"];
const sorted = categories.sort(comparator);
// Result: ['Draft', 'Open', 'Closed']
```

### Get Sort Index

You can also get the numeric sort index for individual status values:

```typescript
import {
  getPRStatusSortIndex,
  getAgentStatusSortIndex,
} from "@continuedev/hub";

// Get PR status index
const draftIndex = getPRStatusSortIndex("Draft"); // Returns: 1
const unknownIndex = getPRStatusSortIndex("Unknown"); // Returns: Infinity

// Get agent status index (case-insensitive)
const planningIndex = getAgentStatusSortIndex("Planning"); // Returns: 0
const planningUpperIndex = getAgentStatusSortIndex("PLANNING"); // Returns: 0
const unknownAgentIndex = getAgentStatusSortIndex("Unknown"); // Returns: Infinity
```

## Constants

### PR_STATUS_ORDER

```typescript
const PR_STATUS_ORDER = ["No PR", "Draft", "Open", "Merged", "Closed"] as const;
```

### AGENT_STATUS_ORDER

```typescript
const AGENT_STATUS_ORDER = ["Planning", "Working", "Blocked", "Done"] as const;
```

## API Reference

### Types

#### `PRStatus`

Union type of all defined PR status values.

#### `AgentStatus`

Union type of all defined agent status values.

#### `AgentSessionGroupBy`

Union type of all supported grouping options: `"PR Status" | "Creator" | "Repository" | "Agent Status"`.

### Functions

#### `getPRStatusSortIndex(status: string): number`

Returns the sort index for a given PR status. Unknown statuses return `Infinity`.

#### `getAgentStatusSortIndex(status: string): number`

Returns the sort index for a given agent status (case-insensitive). Unknown statuses return `Infinity`.

#### `comparePRStatus(a: string, b: string): number`

Comparator function for sorting PR statuses. Use with `Array.sort()`.

#### `compareAgentStatus(a: string, b: string): number`

Comparator function for sorting agent statuses (case-insensitive). Use with `Array.sort()`.

#### `compareAlphabetical(a: string, b: string): number`

Comparator function for alphabetical sorting. Use with `Array.sort()`.

#### `getComparator(groupBy: AgentSessionGroupBy): (a: string, b: string) => number`

Returns the appropriate comparator function for a given grouping option.

## Examples

### Frontend Implementation

```typescript
// Example: Sorting kanban columns
interface KanbanColumn {
  category: string;
  items: AgentSession[];
}

function sortKanbanColumns(
  columns: KanbanColumn[],
  groupBy: AgentSessionGroupBy
): KanbanColumn[] {
  const comparator = getComparator(groupBy);
  return [...columns].sort((a, b) => comparator(a.category, b.category));
}

// Usage
const columns = [
  { category: 'Closed', items: [...] },
  { category: 'No PR', items: [...] },
  { category: 'Draft', items: [...] },
];

const sorted = sortKanbanColumns(columns, 'PR Status');
// Result: columns sorted as ['No PR', 'Draft', 'Closed']
```

### Backend Implementation

```typescript
// Example: API response sorting
function getAgentSessionsByGroup(groupBy: AgentSessionGroupBy) {
  const sessions = fetchAgentSessions();
  const grouped = groupSessions(sessions, groupBy);

  // Sort the group keys using the appropriate comparator
  const comparator = getComparator(groupBy);
  const sortedKeys = Object.keys(grouped).sort(comparator);

  return sortedKeys.map((key) => ({
    category: key,
    sessions: grouped[key],
  }));
}
```

## Testing

The module includes comprehensive unit tests covering:

- Correct ordering for all status types
- Case-insensitive agent status handling
- Unknown status handling (placed at end, alphabetically sorted)
- Comparator functions for all grouping types
- Dynamic comparator selection via `getComparator()`

Run tests with:

```bash
cd packages/hub
npm test
```
