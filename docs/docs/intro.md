# Introduction

![continue-cover-logo](/img/continue-cover-logo.png)

## What is `Continue`?

**`Continue` is the open-source library for accelerating your use of LLMs while coding.**

You define the scenarios where Large Language Models ([LLMs](./concepts/llm.md)) like GPT-4 and StarCoder should act as an autopilot that helps you complete software development tasks. You use [recipes](./concepts/recipe.md) created by others to automate more steps in your development workflows. If a [recipe](./concepts/recipe.md) does not exist or work exactly like you want, you can use the [Continue SDK](./concepts/sdk.md) to create custom [steps](./concepts/step.md) and compose them into personalized [recipes](./concepts/recipe.md). Whether you are using a [recipe](./concepts/recipe.md) created by yourself or someone else, you can also review, reverse, and rerun [steps](./concepts/step.md) with the [Continue GUI](./concepts/gui.md), which helps guide the work done by LLMs and learn when to use and trust them.

## Why do developers use `Continue`?

Many developers have begun to use models like [GPT-4](https://openai.com/research/gpt-4) through [ChatGPT](https://openai.com/blog/chatgpt) while coding; however, this is quite a painful experience because of how much manual copy, paste, and editing is required to construct context for LLMs and then incorporate the generations from LLMs. Many other developers prefer to use open source models or work at organizations where they are unable to use ChatGPT, so they are using [StarCoder](https://huggingface.co/blog/starcoder) [Chat](https://huggingface.co/chat/) and running into the same issues.

`Continue` eliminates the manual copy, paste, and editing required when using LLMs while coding. This accelerates how developers build, ship, and maintain software, while giving them the control to define when LLMs should take actions and the confidence to trust LLMs. In short, it enables developers to do what they have always done: work together to create better and better abstractions that make it easier and easier to automate the repetitive work that people want computers to do.

## Getting started

1. Try out `Continue` in the [GitHub Codespaces Demo](./getting-started.md)
2. Install `Continue` packaged as a [VS Code extension](./install.md)