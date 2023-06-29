# How to use Continue

:::info
**TL;DR: Using LLMs as you code can accelerate you if you leverage them in the right situations. However, they can also cause you to get lost and confused if you trust them when you should not. This page outlines when and where we think you should and should not use Continue.**
:::

## Introduction

Continue will only be as helpful as the LLM you are using to power the edits and explanations. LLMs sometimes hallucinate, so it might make up a library or invent some syntax that does not exist. If something suggested is not working or seems odd to you, it’s best to double check with a Google search to make sure you are not falling into a rabbit hole.

As you use Continue more, you will learn when to trust it. A great way to get started is to just play with it and start to get a sense of what works and what does not. Continue always ask you to accept / reject any changes it suggests, so you can always undo if something goes wrong.

If you are trying to use it for a new task and don’t have a sense of how much Continue can help you complete it, it can often be helpful to start like this:

1. Highlight any code that you don’t understand and type `/explain tell me how this code works`
2. If the explanation seems reasonable, then, while still highlighting the code, type `/explain how would you change this code to do [INSERT TASK]?`
3. If this explanation is also pretty good, then, while still highlighting the code, type `/edit [INSERT TASK]`
4. If it does not work on first attempt, click `reject` on its suggestions and try again—often it will make a different suggestion each time
5. If it not giving you what you want, click `reject` and try again with more specific / clear instructions, articulating exactly what you want it to do and not to do
6. If this still does not work, then you likely need to break down the task into smaller sub-tasks and ask the LLM to do each of those one at a time or just do it yourself manually

Remember: You are responsible for all code that you ship, whether it was written by you or by an LLM that you directed. This means it is crucial that you review what the LLM writes. To make this easier, we provide natural language descriptions of the actions the LLM took in the Continue GUI.

## When to use Continue

Here are tasks that Continue excels at helping you complete:

### Laborious edits 

(e.g. situations where find and replace does not work)

“Change all of these to be like that” but a find/replace doesn’t work

### Writing files from scratch

    - React component
    - Python script
    - Shell script
    - Unit tests

### Creating projects from scratch

“Build the scaffolding for a python package that has a typer cli app to sort the arguments and print them back out”

### Fix highlighted code

    - “change the function to work like this”
    - “do this everywhere”
    - refactoring functions

### Ask about highlighted code or an entire file


### Ask about errors

Have to copy-paste

### Figure out what shell command to run

How to I find running process on port 8000?

### Ask open-ended questions like you would to ChatGPT without leaving your IDE. 

Mostly I’m doing this for ones where I don’t expect multi-turn.

- get explanation of how to get Poetry’s bin directory in my `PATH` on a Windows 10 computer (after a powershell install)

### Editing small existing files


### Tasks with a few steps


## When to not use Continue

Here are tasks that Continue is **not** helpful with today:

### Deep debugging

If you are 20 minutes into debugging a complicated issue across many files, then Continue won’t be able to help you connect the dots yet.

### Multi-file edits in parallel

At the moment, Continue can only edit one file at a time. If you figure out which files need to change, you can direct Continue to help with you change them one-by-one though.


### Tasks with many steps

### Editing large files

### Using context from many other files

### Using context of the entire file

### Highlighting really long lines