---
name: React Performance
description: Catch React anti-patterns that cause unnecessary re-renders or bundle bloat in the GUI.
---

## Context

Continue's GUI is a React application embedded in IDE webviews where performance directly impacts the user experience. The project is actively migrating from styled-components to Tailwind CSS and follows specific React performance best practices documented in `.continue/agents/react-best-practices.md` and `.continue/rules/colors.md`.

## What to Check

Review GUI changes (`gui/` directory) in the PR diff for these patterns:

### Async waterfalls

Sequential awaits that could run in parallel.

```typescript
// Bad - 3 sequential round trips
const user = await fetchUser();
const posts = await fetchPosts();
const comments = await fetchComments();

// Good - 1 round trip
const [user, posts, comments] = await Promise.all([
  fetchUser(),
  fetchPosts(),
  fetchComments(),
]);
```

### Object dependencies in useEffect

Using full objects as dependencies when only a primitive field is needed.

```typescript
// Bad - re-runs on any user field change
useEffect(() => {
  console.log(user.id);
}, [user]);

// Good - re-runs only when id changes
useEffect(() => {
  console.log(user.id);
}, [user.id]);
```

### Stale closure patterns

Using spread with state in callbacks instead of functional updates.

```typescript
// Bad - stale closure risk
const addItem = useCallback(
  (item) => {
    setItems([...items, item]);
  },
  [items],
);

// Good - always uses latest state
const addItem = useCallback((item) => {
  setItems((curr) => [...curr, item]);
}, []);
```

### Explicit color values instead of theme colors

Using hardcoded Tailwind colors instead of the project's theme system.

```tsx
// Bad - hardcoded color
<div className="text-gray-400 bg-zinc-800" />

// Good - theme color
<div className="text-description bg-background" />
```

Available theme colors: `foreground`, `description`, `description-muted`, `background`, `border`, `border-focus`, `primary`, `secondary`, `success`, `warning`, `error`, `accent`, `link`, `input`, `editor`, `badge`, `list-hover`, `list-active`.

### New styled-components usage

The project is migrating from styled-components to Tailwind. New styled-components should not be introduced.

```typescript
// Bad - new styled-component
const Wrapper = styled.div`
  padding: 8px;
`;

// Good - Tailwind
<div className="p-2" />
```

### Array mutation

Using `.sort()` instead of `.toSorted()`, which mutates arrays and breaks React's immutability model.

```typescript
// Bad - mutates original
const sorted = users.sort((a, b) => a.name.localeCompare(b.name));

// Good - creates new array
const sorted = users.toSorted((a, b) => a.name.localeCompare(b.name));
```

## Pass/Fail Criteria

- **Pass** if the GUI changes follow React performance best practices and use the project's theme colors.
- **Fail** if the diff introduces async waterfalls, stale closures, object dependencies in effects, hardcoded colors, new styled-components, or array mutations. Call out specific lines and suggest the fix.

## Key Files to Check

- `gui/src/components/**/*.tsx`
- `gui/src/pages/**/*.tsx`
- `gui/src/hooks/**/*.ts`

## Exclusions

- Changes outside the `gui/` directory.
- Modifications to existing styled-components that are being incrementally migrated (only flag _new_ styled-components).
- Test files in `gui/`.
