# Recipe

**TODO: Better explain in one sentence what this is and what its purpose is**

:::info
A **recipe** is an ordered sequence of [steps](./step.md) that are intended to accomplish some complete task, comprising a workflow that developers use and share with others.
:::

## Details

When enough steps are strung together they become a recipe. Can kick off with slash command, can share/download somehow.

- Although technically just a step itself, since they also subclass the Step class, recipes differentiate themselves from normal steps by ending their name with `Recipe` by
- Technically, everything is a step since everything subclasses the step class. Steps can be composed together. Once steps are composed into a workflow that developers use and share with others, that step is called a recipe and, by convention, it ends with Recipe to signal this
- Actually just a step that is composed of only other steps / recipes.
