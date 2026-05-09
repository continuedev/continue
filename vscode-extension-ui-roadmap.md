# VS Code Extension UI Roadmap

Updated: 2026-05-09

## Current Status

Completed in the repo:

- the config surface now uses a denser left rail with grouped sections and search
- shared settings panels are in place for grouped settings content
- the `Tools & MCPs` page now follows the same grouped-panel pattern as the rest of settings
- settings search can jump directly to subsection anchors across tabs
- the chat surface now has a compact session header and dropdown switcher prototype when session tabs are enabled
- the compact chat header now surfaces remote, background, and live-agent state
- the compact chat switcher now supports inline search for faster multi-chat filtering
- the composer now has a first command-bar prototype via a segmented mode control, runtime selector, and inline config/profile selection
- pending edits now render in a dedicated rail above the composer instead of only replacing the idle toolbar
- the pending edit actions now use `Keep` and `Undo` copy on both the rail and edit outcome surfaces
- the pending edit rail now includes summary badges and top-level batch actions for multi-file edit runs

Primary files touched by that work:

- `gui/src/pages/config/index.tsx`
- `gui/src/pages/config/configTabs.tsx`
- `gui/src/pages/config/components/SettingsPanel.tsx`
- `gui/src/pages/config/sections/ToolsSection.tsx`
- `gui/src/pages/config/components/ToolPoliciesGroup.tsx`
- `gui/src/components/TabBar/TabBar.tsx`
- `gui/src/components/AssistantAndOrgListbox/index.tsx`
- `gui/src/components/ModeSelect/ModeSelect.tsx`
- `gui/src/components/mainInput/InputToolbar.tsx`
- `gui/src/components/mainInput/RuntimeTargetSelect.tsx`
- `gui/src/components/mainInput/Lump/LumpToolbar/BlockSettingsTopToolbar.tsx`
- `gui/src/components/mainInput/Lump/LumpToolbar/PendingApplyStatesToolbar.tsx`
- `gui/src/pages/gui/Chat.tsx`
- `gui/src/pages/gui/chat-tests/Chat.test.tsx`

This starts the chat-shell refactor, but it does not yet deliver richer switcher overflow, a dedicated CLI runtime target, or the final rail polish for dense edit batches.

## Goal

Bring the Yuto VS Code extension UI closer to the control density, hierarchy, and workflow clarity that developers expect from GitHub Copilot Chat, without cloning Copilot visuals or copying branded assets, text, or exact layouts.

The target is a Copilot-inspired interaction model:

- a compact top control bar with clear session, mode, and runtime state
- a composer area that exposes the active execution style and runtime target before send
- a visible pending-changes rail for edited files with clear Keep and Undo actions
- a first-class multi-chat model with strong session switching and naming
- consistent handling for local, CLI, and cloud-backed execution surfaces
- background and live-agent flows that feel like part of the same product, not a separate screen

## Scope

In scope:

- VS Code sidebar webview layout and interaction model
- GUI component hierarchy in `gui/src/**`
- VS Code webview host constraints in `extensions/vscode/src/**`
- chat session navigation, background tasks, and local handoff UI
- mode, runtime, and execution-target controls near the composer
- file-edit review affordances for pending apply states
- design tokens, spacing, density, iconography, and motion guidelines

Out of scope:

- direct visual copying of Copilot assets, icons, or proprietary strings
- a wholesale rewrite of Redux state or protocol contracts unless the UI phases require it
- non-VS Code surfaces such as the standalone CLI TUI
- backend or model-serving changes unrelated to UI state or transport

## Existing Anchors

The current UI already has most of the required behavior, but it is fragmented across separate controls and routes.

Current anchors:

- Webview shell: `extensions/vscode/src/ContinueGUIWebviewViewProvider.ts`
- Main page layout: `gui/src/components/Layout.tsx`
- Chat surface: `gui/src/pages/gui/Chat.tsx`
- Mode picker: `gui/src/components/ModeSelect/ModeSelect.tsx`
- Multi-chat tabs: `gui/src/components/TabBar/TabBar.tsx`
- Session history: `gui/src/components/History/index.tsx`
- Session row states, including remote badges: `gui/src/components/History/HistoryTableRow.tsx`
- Background task screen: `gui/src/components/BackgroundMode/BackgroundModeView.tsx`
- Background task list and open-local affordance: `gui/src/components/BackgroundMode/AgentsList.tsx`
- Pending edit file rail: `gui/src/components/mainInput/Lump/LumpToolbar/PendingApplyStatesToolbar.tsx`
- Batch Keep and Undo actions: `gui/src/components/AcceptRejectDiffButtons.tsx`
- Tool call container and grouped execution UI: `gui/src/pages/gui/ToolCallDiv/index.tsx`

## Current Gaps

The current product has the right primitives but not the right composition.

Primary gaps:

- The main control surface is split between `Layout`, `Chat`, `ModeSelect`, the toolbar under the input, and separate pages.
- The session header is now more compact and exposes remote/background/live state with inline search, but it still needs overflow behavior and richer switcher polish.
- Background tasks are isolated in a dedicated mode, instead of feeling adjacent to live chats and agent handoff.
- Pending apply states are now surfaced above the composer with batch actions and summary badges, but the rail still needs tighter final visual hierarchy and polish.
- Runtime source is now selectable for the available local and cloud-backed profiles, but it still does not expose a dedicated CLI target or deeper runtime details.
- The composer footer is denser than before and now includes config/profile selection, but it still does not function as one fully unified command bar with runtime selection, pending-work state, and send intent in one place.
- The layout hierarchy is flat. Copilot-like products work because the header, transcript, composer, and pending-work rail each have clear responsibility.

## Foundation Already Landed

The settings redesign should be treated as a completed foundation layer for the broader extension refresh.

What it proves:

- compact grouped navigation works within the current sidebar width constraints
- grouped content panels are a better fit than stacked standalone cards for dense settings surfaces
- subsection metadata plus in-page anchors is a workable pattern for deep-linking and keyboard-driven navigation
- `Tools & MCPs` can support denser hierarchy without losing the existing MCP management affordances

What to reuse in the main chat UI:

- the denser spacing and border treatment from the new settings panels
- the subsection metadata pattern for command-bar menus and future chat switcher search
- the updated action hierarchy from the `Tools & MCPs` surface, where the section owns the action and the content remains grouped underneath

## Product Principles

1. Match information architecture, not brand identity.
2. Keep the control bar compact enough to remain visible in the sidebar width range.
3. Put the highest-risk actions near the affected context. File edits belong near the edited file list, not hidden in message bodies.
4. Prefer one unified command surface over multiple scattered toggles.
5. Make runtime source explicit. A developer should always know whether the current flow is local, CLI-backed, or cloud-backed.
6. Preserve keyboard-first workflows and existing VS Code theme integration.
7. Do not break the existing webview protocol unless a phase has a concrete simplification payoff.

## Target Information Architecture

### 1. Top Bar

Purpose:

- current chat title
- session switcher and new chat entrypoint
- overflow actions
- optional compact status indicator for background activity

Target behavior:

- replace the current hidden-or-wrapping tab strip with a tighter Copilot-like session header
- support multiple chats, but hide raw tab semantics when space is constrained
- expose active session title, unsaved or remote state, and background activity count

Primary files:

- `gui/src/components/Layout.tsx`
- `gui/src/components/TabBar/TabBar.tsx`
- `gui/src/components/History/index.tsx`
- `gui/src/components/History/HistoryTableRow.tsx`

### 2. Conversation Body

Purpose:

- transcript, tool activity, thinking, and agent state

Target behavior:

- keep the current transcript model from `Chat.tsx`
- tighten vertical rhythm and spacing to reduce visual noise
- standardize grouped tool-call cards so agent activity reads like one execution block instead of many loosely related widgets

Primary files:

- `gui/src/pages/gui/Chat.tsx`
- `gui/src/pages/gui/ToolCallDiv/index.tsx`
- `gui/src/components/StepContainer/**`

### 3. Pending Work Rail

Purpose:

- show files with pending edits or apply states
- surface per-file and batch Keep and Undo actions

Target behavior:

- promote the existing `PendingApplyStatesToolbar` into a visible rail directly above the composer
- support a collapsed summary state and an expanded per-file state
- rename button labels in the UI spec to `Keep` and `Undo` while preserving existing accept/reject protocol semantics internally if needed

Primary files:

- `gui/src/components/mainInput/Lump/LumpToolbar/PendingApplyStatesToolbar.tsx`
- `gui/src/components/AcceptRejectDiffButtons.tsx`
- `gui/src/components/mainInput/Lump/LumpToolbar/LumpToolbar.tsx`

### 4. Composer Command Bar

Purpose:

- pick execution style
- pick agent type or mode
- pick runtime source
- send the prompt

Target behavior:

- convert the current `ModeSelect` into one part of a broader command bar
- support controls for:
  - execution style: default chat, agent, plan, background, and future autopilot-like workflows
  - runtime target: local, CLI, cloud
  - optional agent preset or persona when relevant
- the bar must stay understandable in narrow sidebar widths

Primary files:

- `gui/src/components/ModeSelect/ModeSelect.tsx`
- `gui/src/components/mainInput/ContinueInputBox.tsx`
- `gui/src/components/mainInput/Lump/LumpToolbar/LumpToolbar.tsx`
- `gui/src/pages/gui/Chat.tsx`

### 5. Background And Handoff Surface

Purpose:

- make background tasks and open-local handoff part of the same navigation model

Target behavior:

- retain the existing background agent capabilities
- redesign `BackgroundModeView` and `AgentsList` to look like a task inbox attached to the same chat system
- make `Open locally` feel like a natural continuation of a conversation, not a side workflow

Primary files:

- `gui/src/components/BackgroundMode/BackgroundModeView.tsx`
- `gui/src/components/BackgroundMode/AgentsList.tsx`
- `gui/src/pages/gui/Chat.tsx`

## UI Spec

### Visual Direction

Use the VS Code theme tokens already wired in `gui/src/styles/theme.ts` and avoid a bespoke color system.

Style targets:

- smaller control surfaces with clearer borders and pressed states
- denser header and footer regions
- less pill-heavy styling for core navigation
- clearer separation between transcript content and chrome
- more consistent use of muted foreground vs active foreground
- stronger hover and selected states for list items, tabs, and segmented controls

### Component Rules

Header:

- one row on normal widths, two rows only as a fallback
- title truncates before controls wrap
- chat switching, new chat, and overflow remain accessible from the header

Mode and runtime controls:

- use segmented or compact dropdown controls rather than many loose buttons
- `Agent`, `Ask`, and `Plan` should read as first-class options even if the internal modes remain `agent`, `chat`, and `plan`
- `Background` should move out of the main mode cycle if it behaves more like a task queue than a conversation mode

Pending edits:

- every edited file should display filename, status, and action buttons in one row
- batch Keep and Undo stay available, but per-file actions become primary

Session navigation:

- show active chat title and a compact chat switcher
- support remote or cloud badges inline with the title, not as detached chips deep in the list

Runtime source:

- show the current execution surface as a distinct control: `Local`, `CLI`, or `Cloud`
- keep it adjacent to send intent so the user does not accidentally run in the wrong place

## Engineering Plan

### Immediate Next Slice

If implementation continues immediately, the next slice should be a shell-first prototype rather than more settings work.

Sequence:

1. Merge background-agent inbox status more directly into the main chat shell instead of isolating it behind a separate screen.
2. Tighten switcher overflow behavior and richer per-session metadata in the compact header.
3. Extend runtime selection beyond local/cloud profile switching into a dedicated CLI-aware target model.

Primary files for that slice:

- `gui/src/components/Layout.tsx`
- `gui/src/components/TabBar/TabBar.tsx`
- `gui/src/components/AssistantAndOrgListbox/index.tsx`
- `gui/src/components/ModeSelect/ModeSelect.tsx`
- `gui/src/components/mainInput/ContinueInputBox.tsx`
- `gui/src/components/mainInput/InputToolbar.tsx`
- `gui/src/components/mainInput/Lump/LumpToolbar/LumpToolbar.tsx`
- `gui/src/components/BackgroundMode/BackgroundModeView.tsx`
- `gui/src/components/BackgroundMode/AgentsList.tsx`
- `gui/src/pages/gui/Chat.tsx`

Constraints:

- avoid protocol changes until the shell composition is stable
- keep keyboard navigation intact while controls move
- validate at narrow sidebar widths first, then expand to full-width webview polish

### Phase 0: Audit And Static Design Inventory

Outcome:

- freeze the current sidebar screenshots and interaction map
- document all current UI states for chat, plan, agent, background, remote handoff, pending edits, and history

Deliverables:

- screenshot board for current extension UI
- annotated component map for `Layout`, `Chat`, `ModeSelect`, `TabBar`, `History`, and background agents

Effort:

- 1-2 days

### Phase 1: Shell And Header Refactor

Outcome:

- replace the current browser-like tab strip with a compact chat header and switcher

Status:

- in progress
- `TabBar` has already been refactored into a compact header plus dropdown switcher
- remote, background, and live-agent state now surface in the compact header
- the switcher now supports inline filtering for faster chat lookup
- remaining work is richer session metadata, overflow behavior, and switcher polish

Primary changes:

- add a new header container component under `gui/src/components/`
- migrate `TabBar` behavior into a compact switcher pattern
- move new-chat, overflow, and session state into the same header

Files:

- `gui/src/components/Layout.tsx`
- `gui/src/components/TabBar/TabBar.tsx`
- `gui/src/components/History/index.tsx`
- `gui/src/components/History/HistoryTableRow.tsx`

Acceptance criteria:

- active session title is always visible
- multiple chats are switchable from one compact header control
- remote or live/background session state is visible from the header or switcher without opening history

Effort:

- 3-5 days

### Phase 2: Composer Command Bar

Outcome:

- create one Copilot-inspired control strip above or inside the composer

Status:

- in progress
- `ModeSelect` now renders as a segmented control instead of a dropdown
- the input toolbar now exposes a real runtime selector for available local and cloud-backed profiles
- the existing assistant/profile selector is now surfaced directly in the composer command bar
- remaining work is to extend runtime selection to dedicated CLI targets, integrate pending-work state, and tighten the overall hierarchy

Primary changes:

- redesign `ModeSelect` into a segmented execution-mode control
- promote the existing assistant/profile selector into the same command bar as mode, runtime, and model
- add runtime-source selection for local, CLI, and cloud-backed flows
- define where `Autopilot` fits: either as a first-class execution style or as a higher-autonomy preset layered on agent mode

Files:

- `gui/src/components/ModeSelect/ModeSelect.tsx`
- `gui/src/components/mainInput/ContinueInputBox.tsx`
- `gui/src/components/mainInput/InputToolbar.tsx`
- `gui/src/components/mainInput/RuntimeTargetSelect.tsx`
- `gui/src/components/mainInput/Lump/LumpToolbar/LumpToolbar.tsx`
- `gui/src/pages/gui/Chat.tsx`

Acceptance criteria:

- a user can identify execution style, active config, and runtime target before sending
- the control strip remains usable at narrow sidebar widths
- keyboard switching still works for primary modes

Effort:

- 4-6 days

### Phase 3: Pending Edits Rail

Outcome:

- turn pending apply states into a first-class edited-files review rail

Status:

- in progress
- pending apply states now render in `Chat` above the composer instead of displacing the idle lump toolbar
- `PendingApplyStatesToolbar` now emphasizes file rows first, with actions aligned to each pending file
- `AcceptRejectDiffButtons` now uses `Keep` and `Undo` copy while preserving the existing internal accept/reject protocol
- the rail now includes summary badges and top-level batch actions for multi-file edit runs
- remaining work is to tighten the visual hierarchy further and polish dense multi-file batches

Primary changes:

- redesign `PendingApplyStatesToolbar` to emphasize files first, actions second
- use `Keep` and `Undo` copy for pending edit actions while preserving internal accept/reject semantics
- support grouped file chips, summary badges, and batch actions for multi-file runs

Files:

- `gui/src/components/mainInput/Lump/LumpToolbar/PendingApplyStatesToolbar.tsx`
- `gui/src/components/AcceptRejectDiffButtons.tsx`
- `gui/src/components/mainInput/Lump/LumpToolbar/EditOutcomeToolbar.tsx`

Acceptance criteria:

- edited files are visible before the next send
- users can Keep or Undo per file and in batch
- the state transition after Keep or Undo is obvious without reading tool logs

Effort:

- 3-4 days

### Phase 4: Background And Cloud Task Inbox

Outcome:

- merge background-agent flows into the same overall chat product language

Primary changes:

- redesign `BackgroundModeView` and `AgentsList`
- clarify the difference between active local chat, remote cloud task, and background execution
- add better empty, loading, and handoff states

Files:

- `gui/src/components/BackgroundMode/BackgroundModeView.tsx`
- `gui/src/components/BackgroundMode/AgentsList.tsx`
- `gui/src/pages/gui/Chat.tsx`

Acceptance criteria:

- background tasks feel like a queue attached to the current workspace
- `Open locally` is clear and low-risk
- local vs cloud task provenance is obvious from the card chrome

Effort:

- 3-5 days

### Phase 5: Tool Activity And Transcript Polish

Outcome:

- align tool activity cards and transcript density with the new shell

Primary changes:

- standardize grouped tool cards
- reduce visual noise in transcript wrappers and tool headers
- improve transitions between assistant content, tool activity, and pending edits

Files:

- `gui/src/pages/gui/ToolCallDiv/index.tsx`
- `gui/src/pages/gui/ToolCallDiv/**`
- `gui/src/components/StepContainer/**`
- `gui/src/pages/gui/Chat.tsx`

Acceptance criteria:

- tool activity is scannable in long agent runs
- pending work, applied work, and background work are visually distinct

Effort:

- 3-4 days

### Phase 6: VS Code Host Integration And Polish

Outcome:

- make the new UI resilient inside the sidebar host and full-screen view

Primary changes:

- verify webview sizing and layout behavior in the sidebar width range
- tune host-level padding, resizing, and theme propagation
- audit any missing command or context menu hooks needed for the new chrome

Files:

- `extensions/vscode/src/ContinueGUIWebviewViewProvider.ts`
- `extensions/vscode/src/commands.ts`
- `extensions/vscode/src/extension/VsCodeMessenger.ts`

Acceptance criteria:

- the UI works in narrow sidebar, expanded sidebar, and full-screen webview variants
- no host-level clipping or reflow bugs for the command bar or pending-edits rail

Effort:

- 2-3 days

## Cross-Cutting Requirements

### Design System

- continue to use VS Code theme variables from `gui/src/styles/theme.ts`
- define a compact spacing scale for sidebar chrome
- standardize button sizes, icon sizes, and text sizes for the control bar

### Accessibility

- full keyboard access for mode, runtime, session, and edit controls
- focus order that matches visual order
- visible focus states on all compact controls
- screen-reader labels for Keep, Undo, session switch, and runtime selectors

### Testing

Required additions per phase:

- component tests for new header and command bar states
- chat tests for mode switching, session switching, and pending-edit actions
- extension tests only when host protocol changes are required
- manual regression script for narrow sidebar width, remote handoff, and background queue transitions

### Telemetry

Capture only interaction events that help product decisions:

- mode changes
- runtime target changes
- session switch usage
- per-file Keep vs Undo usage
- background task open-local usage

## Open Product Decisions

1. Should `Autopilot` be a new execution style, or a preset layered on top of `Agent`?
2. Should `Background` remain a mode in the composer, or move to a separate inbox tab in the header?
3. Should `Ask` be a renamed `Chat` mode in the UI, or should `Ask` remain a lightweight no-tools mode with slightly different messaging?
4. Does `CLI` mean a local CLI relay inside the current machine, or a distinct remote-backed runtime option in the product model?
5. Should `Keep` and `Undo` replace `Accept` and `Reject` only in the UI copy, or in internal naming as well?

## Recommended Delivery Order

1. Phase 0 and Phase 1
2. Phase 2
3. Phase 3
4. Phase 4
5. Phase 5 and Phase 6

This keeps the largest user-visible structural improvements early while reusing the existing state model and protocol surfaces wherever possible.

## Definition Of Done

This roadmap is complete when:

- the sidebar has one clear header, one clear conversation area, one clear pending-work rail, and one clear composer command bar
- multi-chat switching is compact and reliable
- local, CLI, and cloud execution surfaces are explicit in the UI
- pending file edits are reviewable and actionable without digging into transcript details
- background agents and live local handoff feel like part of the same workflow
- the extension looks and behaves like a modern, dense coding assistant UI without depending on Copilot-specific branding
