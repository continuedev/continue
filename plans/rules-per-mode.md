# Plan: global rules toggle per mode

Status: PR 2 of 2 (the plan ships with PR 1). Written 2026-11-04 against `origin/main` 010fa2c86. Roadmap item "A global rules toggle per mode" (`ROADMAP.md`, Later; `fork-plan.md` 4.7 item 4).

## 1. Problem

Rules are all or nothing per rule. The only switch is a per-rule on/off in the Rules section (`ui.ruleSettings`, kept in the webview), which applies to every mode. You cannot say "my coding rules are noise in Chat and Plan, send them only in Agent", short of toggling each rule by hand each time.

## 2. What exists

- Rules are loaded in core into `config.rules` (`RuleWithSource[]`) and sent to the webview.
- The webview applies them in `constructMessages` (`gui/src/redux/util/constructMessages.ts`) through `getSystemMessageWithRules`, with `ui.ruleSettings` as per-rule policies. Mode is `state.session.mode` (`chat | agent | plan`, plus `background`).
- `modeModels` in config.yaml is the template for a per-mode setting: schema in `packages/config-yaml`, resolved in `core/config/yaml`, saved with comment-preserving edits (`saveModeModels` through `editConfigFile`), a `config/setModeModels` message in `core/protocol/core.ts` and `passThrough.ts`, and the same name in `MessageTypes.kt`.

## 3. Design

- config.yaml, top level, omitted means enabled:

  ```yaml
  rulesByMode:
    chat: false
    plan: false
    agent: true
  ```

- Schema: `rulesByMode: { chat?: boolean, agent?: boolean, plan?: boolean }` in `baseConfigYamlSchema`.
- Core passes it through `ContinueConfig` and the serialized config to the webview as `rulesByMode`.
- Rules disabled for the current mode are not sent: `constructMessages` takes the mode flag and uses no rules when off. This sits in front of per-rule policies, so it cannot re-enable an off rule and a per-rule "off" still wins when the mode is on. Background mode follows Agent.
- The Rules section gets three toggles (Chat, Plan, Agent). Changing one sends `config/setRulesByMode`, which edits config.yaml with the A1 helpers (`editConfigFile`), so comments and key order stay. A user without a config.yaml gets `saved: false` and the UI says so.
- The rules peek under the input shows nothing for a disabled mode, because no rules are applied.

## 4. PRs

One PR: schema and tests, core load and save and tests, protocol and Kotlin message type, constructMessages and the Rules section toggles, this plan's status.

## 5. Tests

- config-yaml: schema accepts the three booleans and rejects other values or modes.
- core: `applyRulesByModeUpdate` keeps other keys and comments, removes an entry on `null`, drops the key when empty; a round trip through `editConfigFile` keeps comments; the loaded config carries the flags.
- gui: `constructMessages` sends no rules when the mode is off and still applies per-rule policies when on; the toggles send the message.

## 6. Not done

- Edit mode (inline edit) and autocomplete are not modes here and keep applying rules.
- The `request_rule` tool still lists rules in a disabled mode; it only fetches a rule the model asks for by name.
- Per-workspace override (`.continue/config.yaml`) is not supported; the setting is global config.yaml only.
