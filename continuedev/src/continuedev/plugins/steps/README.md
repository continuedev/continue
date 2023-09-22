# Steps

Steps are the composable unit of action in Continue. They define a `run` method which has access to the entire `ContinueSDK`, allowing you to take actions inside the IDE, call language models, and more. In this folder you can find a number of good examples.

## How to write a step

a. Start by creating a subclass of `Step`

You should first consider what will be the parameters of your recipe. These are defined as attributes in the Pydantic class. For example, if you wanted a "filepath" attribute that would look like this:

```python
class HelloWorldStep(Step):
    filepath: str
    ...
```

b. Next, write the `run` method

This method takes the ContinueSDK as a parameter, giving you all the tools you need to write your steps (if it's missing something, let us know, we'll add it!). You can write any code inside the run method; this is what will happen when your step is run, line for line. As an example, here's a step that will open a file and append "Hello World!":

```python
class HelloWorldStep(Step):
    filepath: str

    async def run(self, sdk: ContinueSDK):
        await sdk.ide.setFileOpen(self.filepath)
        await sdk.append_to_file(self.filepath, "Hello World!")
```

c. Finally, every Step is displayed with a description of what it has done

If you'd like to override the default description of your step, which is just the class name, then implement the `describe` method. You can:

- Return a static string
- Store state in a class attribute (prepend with a double underscore, which signifies (through Pydantic) that this is not a parameter for the Step, just internal state) during the run method, and then grab this in the describe method.
- Use state in conjunction with the `models` parameter of the describe method to autogenerate a description with a language model. For example, if you'd used an attribute called `__code_written` to store a string representing some code that was written, you could implement describe as `return models.summarize.complete(f"{self.\_\_code_written}\n\nSummarize the changes made in the above code.")`.

Here's an example:

```python
class HelloWorldStep(Step):
    filepath: str

    async def run(self, sdk: ContinueSDK):
        await sdk.ide.setFileOpen(self.filepath)
        await sdk.append_to_file(self.filepath, "Hello World!")

    def describe(self, models: Models):
        return f"Appended 'Hello World!'  to {self.filepath}"
```
