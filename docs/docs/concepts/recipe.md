# Recipe

## One sentence definition

A `recipe` is a sequence of [steps](./step.md) composed into a workflow that developers use and share with others.

## What else to know

Although technically just a step itself, since they also subclass the Step class, recipes differentiate themselves from normal steps by ending their name with `Recipe` by

Technically, everything is a step since everything subclasses the step class. Steps can be composed together. Once steps are composed into a workflow that developers use and share with others, that step is called a recipe and, by convention, it ends with Recipe to signal this

*TODO: Explain in detail what this is and what its purpose is*

An ordered sequence of steps that are intended to accomplish some complete task

Actually just a step that is composed of only other steps / recipes.

Altnerative names: workflow, plugin