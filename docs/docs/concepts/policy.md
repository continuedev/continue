# Policy

**TODO: Better explain in one sentence what this is and what its purpose is**

:::info
A **policy** is decides what step to run next and is associated with a [autopilot](./autopilot.md)
:::

## Details

A relic of my original plan that ended up being the place to define slash commands, the command run on startup, and other weird stuff that you might want to inject after certain other steps. This may be the place where "hooks" turn out to be implemented. Much of this may be configurable through `continue.json/yaml` config file (this is where steps that run on GUI opening are currently configured.). Simply takes the history and returns a single step to run next. Can return None if no step to take next. Then user input will kick it off again eventually. Autopilot has a single policy that it follows, so definitely a global/user-configurable type of thing.

- The Policy is where slash commands are defined
- The Policy is a global thing, so probably something we'll want to make user-configurable if we don't significantly change it
