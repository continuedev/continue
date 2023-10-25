---
title: Other Configuration
description: Swap out different LLM providers
keywords: [temperature, custom policies, custom system message]
---

# Other Configuration

See the [ContinueConfig Reference](../reference/config) for the full list of configuration options.

## Customize System Message

You can write your own system message, a set of instructions that will always be top-of-mind for the LLM, by setting the `system_message` property to any string. For example, you might request "Please make all responses as concise as possible and never repeat something you have already explained."

System messages can also reference files. For example, if there is a markdown file (e.g. at `/Users/nate/Documents/docs/reference.md`) you'd like the LLM to know about, you can reference it with [Mustache](http://mustache.github.io/mustache.5.html) templating like this: "Please reference this documentation: {{ Users/nate/Documents/docs/reference.md }}". As of now, you must use an absolute path.

## Temperature

Set `temperature` to any value between 0 and 1. Higher values will make the LLM more creative, while lower values will make it more predictable. The default is 0.5.

## Custom Policies

Policies can be used to deeply change the behavior of Continue, or to build agents that take longer sequences of actions on their own. The [`DefaultPolicy`](https://github.com/continuedev/continue/blob/main/server/continuedev/plugins/policies/default.py) handles the parsing of slash commands, and otherwise always chooses the `SimpleChatStep`, but you could customize by for example always taking a "review" step after editing code. To do so, create a new `Policy` subclass that implements the `next` method:

```python
class ReviewEditsPolicy(Policy):

    default_step: Step = SimpleChatStep()

    def next(self, config: ContinueConfig, history: History) -> Step:
        # Get the last step
        last_step = history.get_current()

        # If it edited code, then review the changes
        if isinstance(last_step, EditHighlightedCodeStep):
            return ReviewStep()  # Not implemented

        # Otherwise, choose between EditHighlightedCodeStep and SimpleChatStep based on slash command
        if observation is not None and isinstance(last_step.observation, UserInputObservation):
            if user_input.startswith("/edit"):
                return EditHighlightedCodeStep(user_input=user_input[5:])
            else:
                return SimpleChatStep()

            return self.default_step.copy()

        # Don't do anything until the user enters something else
        return None
```

Then, in `~/.continue/config.py`, override the default policy:

```python
config=ContinueConfig(
    ...
    policy_override=ReviewEditsPolicy()
)
```
