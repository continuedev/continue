# Patch 09: Pending ToolCall Button Overflow Fix

## Summary

The **Accept/Reject** buttons in `PendingToolCallToolbar` are clipped (partially or fully hidden) when the VS Code sidebar panel is narrow or after extended chat sessions with many code blocks and terminal outputs. This patch fixes the layout overflow by switching from flexbox to CSS Grid, replacing viewport-relative widths with container-relative widths, and adding proper shrink constraints throughout the chat UI hierarchy.

---

## Affected Files

| File | Change |
|------|--------|
| `gui/src/components/mainInput/Lump/LumpToolbar/PendingToolCallToolbar.tsx` | Switch toolbar row from flexbox to CSS Grid |
| `gui/src/components/mainInput/Lump/index.tsx` | Add `min-w-0`, `overflow-hidden` |
| `gui/src/components/StyledMarkdownPreview/index.tsx` | `calc(100vw-24px)` → `100%`, `scroll` → `auto` |
| `gui/src/components/UnifiedTerminal/UnifiedTerminal.tsx` | `calc(100vw-24px)` → `100%`, `scroll` → `auto` |
| `gui/src/pages/gui/Chat.tsx` | `StepsDiv` add `overflow-x: hidden` |
| `gui/src/pages/gui/index.tsx` | `main` add `min-w-0` |

---

## Root Causes

### 1. Flexbox with `shrink-0` causes overflow

The toolbar used flexbox with `shrink-0` on the buttons container. When the sidebar panel width was insufficient, the buttons could not shrink and were pushed outside the visible area.

```tsx
// BEFORE — flexbox, buttons can be pushed out
<div className="border-input bg-input flex items-center gap-2 rounded border">
  <span className="text-description flex-1 truncate text-xs italic">
    {/* Tool call name */}
  </span>
  <div className="flex items-center gap-1">
    <Button>Reject</Button>
    <Button>Accept</Button>  {/* ← clipped when narrow */}
  </div>
</div>
```

### 2. Viewport-relative `max-width` expands beyond container

`<pre>` elements used `max-width: calc(100vw - 24px)`. In a sidebar, `100vw` is the full **viewport** width (e.g., 1920px), not the sidebar width (e.g., 300px). This caused code blocks and terminal outputs to expand far beyond the sidebar container, pushing the entire layout outside the `overflow-x: hidden` boundary.

```css
/* BEFORE — 100vw = viewport width, not container width */
pre {
  max-width: calc(100vw - 24px);  /* 1896px on 1920px screen! */
  overflow-x: scroll;
}
```

### 3. Missing shrink constraints in flex hierarchy

The flex container hierarchy from `GUI` → `main` → `Chat` → `StepsDiv` → `Lump` → `PendingToolCallToolbar` lacked `min-w-0` at critical points, preventing proper shrinking when content overflowed.

---

## Code Changes

### 1. `PendingToolCallToolbar.tsx` — Grid layout for buttons

```tsx
// AFTER — CSS Grid ensures buttons always get intrinsic width
<div className="flex w-full min-w-0 flex-col pb-0.5">
  {pendingToolCalls.map((toolCall, index) => (
    <div
      key={toolCall.toolCallId}
      className="border-input bg-input grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center rounded border"
    >
      <span className="text-description truncate px-1 text-xs italic">
        {toolCall.tool?.displayTitle ?? toolCall.toolCall.function.name}
      </span>

      <div className="flex items-center gap-1 pr-1">
        <Button variant="ghost" size="sm">Reject</Button>
        <Button variant="primary" size="sm">Accept</Button>
      </div>
    </div>
  ))}
</div>
```

**Key changes:**
- `flex` → `grid min-w-0 grid-cols-[minmax(0,1fr)_auto]`
  - `minmax(0,1fr)`: tool call name column can shrink to 0 if needed
  - `auto`: buttons column always gets intrinsic width (never clipped)
- `flex-1` → removed (grid handles distribution)
- `gap-2` → removed (grid gap not needed with explicit columns)
- `px-1` on span, `pr-1` on buttons container — consistent padding

### 2. `Lump/index.tsx` — Container shrink constraints

```tsx
// AFTER
export function Lump() {
  return (
    <div className="bg-input rounded-t-default border-command-border mx-1 min-w-0 overflow-hidden border-l border-r border-t">
      <div className="min-w-0 px-1 py-0.5">
        <LumpToolbar />
      </div>
    </div>
  );
}
```

**Key changes:**
- `mx-1.5` → `mx-1` (slightly tighter margin)
- Added `min-w-0` — allow shrinking below content width
- Added `overflow-hidden` — clip overflow instead of expanding
- Inner div: `xs:px-2` removed, `min-w-0` added

### 3. `StyledMarkdownPreview/index.tsx` — Container-relative code blocks

```css
/* AFTER */
pre {
  white-space: ${(props) => props.whiteSpace};
  background-color: ${vscEditorBackground};
  border-radius: ${defaultBorderRadius};

  max-width: 100%;        /* ← container width, not viewport */
  overflow-x: auto;       /* ← auto instead of scroll */
  overflow-y: hidden;

  padding: 8px;
}
```

**Why `100%` instead of `calc(100vw - 24px)`:**
- `100%` = width of the **containing element** (the sidebar panel)
- `100vw` = width of the **entire viewport** (the whole screen)
- In a 300px sidebar on a 1920px screen: `100%` = 300px, `100vw` = 1920px

**Why `auto` instead of `scroll`:**
- `scroll` always shows scrollbar track (even when not needed)
- `auto` only shows scrollbar when content actually overflows

### 4. `UnifiedTerminal.tsx` — Same fix for terminal outputs

```css
/* AFTER */
const TerminalContent = styled.div`
  pre {
    white-space: pre-wrap;
    max-width: 100%;        /* ← container width */
    overflow-x: auto;       /* ← auto instead of scroll */
    overflow-y: hidden;
    padding: 8px;
    margin: 0;
  }
  /* ... */
`;
```

Same reasoning as StyledMarkdownPreview — terminal outputs can also contain wide content that previously expanded beyond the sidebar.

### 5. `Chat.tsx` — Steps container overflow containment

```tsx
const StepsDiv = styled.div`
  position: relative;
  background-color: transparent;
  overflow-x: hidden;  /* ← NEW: contain horizontal overflow */

  & > * {
    position: relative;
  }
  /* ... */
`;
```

This is the **safety net** — even if some child element still overflows, it will be clipped at the `StepsDiv` boundary instead of pushing the entire layout.

### 6. `gui/index.tsx` — Main layout shrink constraint

```tsx
// AFTER
export default function GUI() {
  return (
    <div className="flex min-h-0 w-screen flex-row overflow-x-hidden">
      <aside className="4xl:flex border-vsc-input-border no-scrollbar hidden min-h-0 w-96 overflow-y-auto border-0 border-r border-solid">
        <History />
      </aside>
      <main className="no-scrollbar flex min-h-0 min-w-0 flex-1 flex-col">
        <Chat />
      </main>
    </div>
  );
}
```

**Key change:**
- Added `min-w-0` to `<main>` — the primary flex child must be allowed to shrink below its content width, otherwise wide content in `Chat` would expand the entire main panel.

---

## Layout Hierarchy (after fix)

```
GUI (flex row, overflow-x-hidden)
├── aside (History) — fixed width 384px
└── main (flex-1, min-w-0) ← NEW: can shrink
    └── Chat
        └── StepsDiv (overflow-x-hidden) ← NEW: contains overflow
            ├── StepContainer (messages)
            │   └── StyledMarkdownPreview
            │       └── pre (max-width: 100%) ← NEW: container-relative
            ├── UnifiedTerminal
            │   └── pre (max-width: 100%) ← NEW: container-relative
            └── Lump
                └── PendingToolCallToolbar
                    └── grid-cols-[minmax(0,1fr)_auto] ← NEW: buttons always visible
```

---

## Behavior Matrix

| Scenario | Before | After |
|----------|--------|-------|
| Narrow sidebar (~300px) | Accept/Reject buttons clipped | ✅ Buttons always visible |
| Extended chat with many code blocks | Layout push overflow | ✅ Contained within sidebar |
| Terminal output with long lines | Horizontal scroll on viewport | ✅ Scroll inside container |
| Wide markdown tables | Table expands beyond sidebar | ✅ Contained with horizontal scroll |
| Normal width sidebar (~400px+) | Works fine | ✅ Still works fine |

---

## Trade-offs

- **+** Buttons never clip, regardless of sidebar width
- **+** Consistent layout containment throughout chat UI
- **+** Code blocks and terminals scroll within their containers
- **-** Very long tool call names are truncated (but this is acceptable — user can hover or the name is usually short)
- **-** Slightly more complex CSS (Grid instead of Flexbox for one row)

---

## Testing

### Manual test cases

1. **Narrow sidebar**
   - Resize VS Code sidebar to ~300px
   - Trigger a tool call (e.g., `@terminal` command)
   - Verify Accept/Reject buttons are fully visible

2. **Extended chat session**
   - Have a long conversation with multiple code blocks and terminal outputs
   - Trigger a tool call at the end
   - Verify buttons are not clipped

3. **Code block overflow**
   - Ask model to generate a very wide code block (e.g., long JSON line)
   - Verify horizontal scroll is inside the code block container, not the whole sidebar

4. **Terminal output overflow**
   - Run a command with very wide output (e.g., `ps aux`)
   - Verify terminal scrolls horizontally within its container

---

## Upstream Status

- **PR:** [#13131](https://github.com/continuedev/continue/pull/13131)
- **Branch:** `fix/pending-toolcall-button-overflow` (or similar)
- **Status:** 🟢 OPEN — under review by `sestinj`
- **Type:** Bug fix (GUI layout)
- **Scope:** Pure CSS/Tailwind changes, no logic changes

---

## Verification

```bash
# 1. Confirm all files have the patch
grep -n "grid-cols-\[minmax(0,1fr)_auto\]" \
  gui/src/components/mainInput/Lump/LumpToolbar/PendingToolCallToolbar.tsx
# Expected: 1 match

grep -n "max-width: 100%" \
  gui/src/components/StyledMarkdownPreview/index.tsx
# Expected: 1 match

grep -n "max-width: 100%" \
  gui/src/components/UnifiedTerminal/UnifiedTerminal.tsx
# Expected: 1 match

grep -n "overflow-x: hidden" \
  gui/src/pages/gui/Chat.tsx
# Expected: 1 match

grep -n "min-w-0" \
  gui/src/pages/gui/index.tsx
# Expected: 1 match

# 2. Test in Continue
# - Open Continue sidebar
# - Resize sidebar to minimum width
# - Trigger a tool call (e.g., ask to edit a file)
# - Verify Accept/Reject buttons are fully visible
```

---

## Related

- This patch complements the custom on-prem build but is **independent** of NIM/vLLM/vision-proxy patches
- Could benefit all Continue users, especially those with narrow sidebars or on smaller screens
- No dependency on any other custom patch
