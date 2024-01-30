---
title: 🧑‍🎓 How to use Continue
description: Using LLMs as you code with Continue
keywords: [how to, edit, refactor, boilerplate, context]
---

# 🧑‍🎓 How to use Continue

:::info
**TL;DR: Using LLMs as you code can accelerate you if you leverage them in the right situations. However, they can also cause you to get lost and confused if you trust them when you should not. This page outlines when and where we think you should and should not use Continue.**
:::

## Introduction

Continue will only be as helpful as the LLM you are using to power the edits and explanations. LLMs sometimes hallucinate, so it might make up a library or invent some syntax that does not exist. If something suggested is not working or seems odd to you, it’s best to double check with a Google search to make sure you are not falling into a rabbit hole.

As you use Continue more, you will learn when to trust it. A great way to get started is to just play with it and start to get a sense of what works and what does not. Continue always ask you to accept / reject any changes it suggests, so you can always undo if something goes wrong.

If you are trying to use it for a new task and don’t have a sense of how much Continue can help you complete it, it can often be helpful to start like this:

'Highlight' refers to the act of selecting a text range in a file and pressing 'cmd+shift+M' (Macos) or 'ctrl+shift+M' (Windows) to include it in the Continue chat message.

1. Highlight the code section(s) that you don’t understand and type "tell me how this code works" in the input box
2. If the explanation seems reasonable, then, while still highlighting the code section(s), type "how would you change this code to [INSERT TASK]?"
3. If this explanation is also pretty good, then, while still highlighting the code section(s), type `/edit [INSERT TASK]`. If you like the suggested diff, use `cmd+shift+enter` to accept the changes.
4. If it does not work on first attempt, use `cmd+shift+backspace` to reject the changes and try again—often it will make a different suggestion each time
5. If it is not giving you what you want after another attempt, reject and try again with more specific / clear instructions, articulating exactly what you want it to do and not to do
6. If this still does not work, then you likely need to break down the task into smaller sub-tasks and ask the LLM to do each of those one at a time or just do it yourself manually

Remember: You are responsible for all code that you ship, whether it was written by you or by an LLM that you directed. This means it is crucial that you review what the LLM writes. To make this easier, we provide natural language descriptions of the actions the LLM took in the Continue GUI.

## When to use Continue

Here are tasks that Continue excels at helping you complete:

### Laborious edits

Continue works well in situations where find and replace does not work (i.e. “/edit change all of these to be like that”)

Examples

- "/edit Use 'Union' instead of a vertical bar here"
- “/edit Make this use more descriptive variable names”

### Writing files from scratch

Continue can help you get started building React components, Python scripts, Shell scripts, Makefiles, unit tests, etc.

Examples

- “/edit write a python script to get posthog events"
- “/edit add a react component for syntax highlighted code"

### Creating boilerplate from scratch

Continue can go even further. For example, it can help build the scaffolding for a Python package, which includes a typer cli app to sort the arguments and print them back out.

Examples

- “/edit use this schema to write me a SQL query that gets recently churned users”
- “/edit create a shell script to back up my home dir to /tmp/"

### Fix highlighted code

After selecting the code section(s), try to refactor it with Continue (e.g “/edit change the function to work like this” or “/edit do this everywhere”)

Examples

- “/edit migrate this digital ocean terraform file into one that works for GCP”
- “/edit rewrite this function to be async”

### Ask about highlighted code or an entire file

If you don't understand how some code works, highlight it and ask "how does this code work?"

Examples

- “where in the page should I be making this request to the backend?”
- “how can I communicate between these iframes?”

### Ask about errors

Continue can also help explain errors / exceptions and offer possible solutions. When you come across an error / exception in your terminal, press `cmd+shift+r` (MacOS) / `ctrl+shift+r` (Windows). This will throw the stack trace into Continue and ask for it to explain the issue to you.

### Figure out what shell command to run

Instead of switching windows and getting distracted, you can ask things like "How do I find running process on port 8000?"

Examples

- "what is the load_dotenv library name?"
- "how do I find running process on port 8000?"

### Ask single-turn open-ended questions

Instead of leaving your IDE, you can ask open-ended questions that you don't expect to turn into multi-turn conversations.

Examples

- “how can I set up a Prisma schema that cascades deletes?”
- "what is the difference between dense and sparse embeddings?"

### Editing small existing files

You can highlight an entire file and ask Continue to improve it as long as the file is not too large.

Examples

- “/edit here is a connector for postgres, now write one for kafka”
- "/edit Rewrite this API call to grab all pages"

### Using context from multiple other files

Similar to how you would make changes manually, focus on one file at a time. But if there is key information in other files, highlight those sections of code too to be used as additional context

### Tasks with a few steps

There are many more tasks that Continue can help you complete. Typically, these will be tasks that don't involve too many steps to complete.

Examples

- “/edit make an IAM policy that creates a user with read-only access to S3”
- “/edit change this plot into a bar chart in this dashboard component”

## When to not use Continue

Here are tasks that Continue is **not** helpful with today:

### Deep debugging

If you are 20 minutes into debugging a complicated issue across many files, then Continue won’t be able to help you connect the dots yet. That said, Continue can provide ideas of what you might do at different points if you share what you have figured out along the way and ask for ideas of what to try.

### Multi-file edits in parallel

At the moment, Continue can only edit one file at a time. If you figure out which files need to change, you can direct Continue to help you change them one at a time though.

### Using context of the entire file

If files get too large, it can be difficult for Continue to fit them into the limited LLM context windows. Try to highlight the section of code that include the relevant context. It's rare that you need the entire file.

### Editing large files

Similarly, if you try to edit too many lines at once, you might run into context window limits. It also will likely be very slow to apply the suggestions.

### Highlighting really long lines

If you highlight very long lines (e.g. a complex SVG), you might also run into issues like those above.

### Tasks with many steps

There are other tasks that Continue won't be able to take on entirely at once. However, typically, if you figure out how to break the task into sub-tasks, you can get help from Continue with those.
