### List of concrete things that will be built

- Interface with language servers
- Central place to initiate language model suggestions
- Abstracted set of tools around language servers and other complicated sources of information
- Way to keep track of reversible/replayable series of human/LLM changes to code, at better granularity that git
- A library of prompts and tools to combine them to yield good examples
- A basic LLM agnostic prompting interface
- The server or something that can be integrated easily into an extension for any IDE
- A CLI tool that can be called to make a one-off change on some codebase
- A default interface that can run at localhost, but which we will also create a desktop application version of
- Tools to parse LLM output to get file outputs
- Parse and unparse tracebacks in any language
- FileEdit/FileDiff creation from LLM output where you don't necessarily know the position of the lines
- Test generation and tools to use
- Tools/prompts for summarizing groups of file edits
- Need to be able to remove/add files. Is there any other reversible action you should be considering? Does git track anything else? Renaming files, or adding/removing folders.

There should be different levels of abstraction at which you can work with these concepts. One of them should be as simple as

- You write a formatted string with FormattedStringPrompter
- Specify a source for each of the strings, by a simple strongly typed enum, like traceback or something else
  maybe not realistic or useful

---

- One big thing that happens as you're fixing errors is that you encounter a fork in the road. The language model should be able to present you with both options, and you just click to decide.
- What I'm doing right now: I write a bunch of code without running it, then ahve to solve a bunch of errors at once, but small obvious ones. We can do this all automatically.

---

### Current limitations:

- We are always specifying how to use the tools directly instead of letting the AI choose how to use them on its own. You should expand to allow this.
- We want the history of both user and AI changes to be reflected as a single agent. So you need to watch for user updates to the filesystem. See https://pythonhosted.org/watchdog/quickstart.html#quickstart
- Language servers are a big deal, you've not done anything about that quite yet.
  - class to manage all of them, and some way to configure which to run.
  - call them inside actions? Probably not. Does language server ever make changes? Maybe you just create a python client
- You want this library to play well with IDEs, which means it should see file changes even before they are saved. What you're building might look more like a language server than anything else then. Just an extended language server. Something else that points at this is your need for watching the filesystem for changes. This is precisely what the LSP does.
- Prompts don't always transfer well between models. So a prompt should actually have different versions for each model, instead of being just a single string.
- Kind of weird syntax for creating your own actions, validators, etc... USE ANNOTATIONS
- Stuff should be serializable
- We also want to be able to answer questions, not just generate file edits.

### Plugins

Plugin is a more general word, which subsumes validator plugins, tool plugins, what else?

### Continue as Extended Language Server

- Language server capable of directly editing the filesystem and running commands.
- Really just needs to write to files, or suggest file edits. But actually in an ideal future it can do more, like press every button in the IDE

The question isn't now "do we want to use it," but "is it the actual thing we are building?" I've realized that we need 1) to watch files for changes and make suggestions based off of these, 2) need to be language agnostic, 3) need to plug in to any IDE ideally. All of these things are the bread and butter of LSP. It seems like what we might actually be building is a headless LSP client, or an LSP server with a backdoor, or an LSP server with more endpoints. Trying to figure out where it best fits in.

- We're not totally focusing on responding to small updates, so it might be okay to later build our own endpoint to watch for non-save updates to files.
- There aren't so many things that need to be done in their own language that aren't already done in LSP, are there?

Overall, I think you should just think of this framework as a way of giving tools to language models and then putting them in a loop to edit, validate, run code. Tools are the plugins, and so you shouldn't have to build all of them, and they should be written in any language.

The LSP Tool is just another tool. It will be common, so you want it built-in, but it's just another tool.
The thing about LSP is that there's a lot of state going on, and it needs to be running the whole time.
An edit in VS Code before saving can just be a hook to watch for, can replace the WatchDog thing.

A cool feature of what we're doing is that we might summarize the changes made by a human, such that they can separate their work into describable and reversible parts.

In essence, our framework makes it easy for people to match up problems to prompts. So people can share their solutions of the form "whenever you see this error, you can run this prompt with these tools, and it will fix it automatically".

I'm finding that the validators are pretty tightly tied to the actions. Should this be reflected in a single class for both?

---

The final simplification you could make: policies are actions. So the very first action that is always called is actually a policy, but it might be instantiated with a specific action first.

Don't do this right now. But you might want to, and make it DAGs all the way down.

Other consideration: a good amount of work could go into defining the spaces of observations.

"""
What do they do that's interesting:

- agent has get_allowed_tools() method
- They have analog of Prompter with PromptTemplate
- they pass an LLM object to instantiate the Chain object

What doesn't LangChain do right?

They don't have stopping as an action
Not reversible
"""

Runners could also be pluginable. They are like the middleware for actions.

- Ask for permission
- Keep track of substeps in DAG
- Keep locks on resources, have steps declare the resources they will use / want to lock up

Policies should be generators! This makes it much more natural to group steps. Also means you can probably just define a decorator to a generator function that will turn it into a full policy class.
This is just syntactic sugar though.

can you also make an annotation for actions, so you just have to write the run function? And then automatically add it to the pluggy library somehow.
