# Create a recipe

Check out the [recipes folder](https://github.com/continuedev/continue/tree/main/continuedev/src/continuedev/recipes) to learn how to write your own.

**TODO: Describe step-by-step how to create a recipe**

Points to include

- Where to create recipes
- How to create a step
- How to create recipe
- Using models

1. Create a recipe here

continue/continuedev/src/continuedev/recipes

## 1. Create a step

### a. Start by creating a subclass of Step

You should first consider what will be the parameters of your recipe. These are defined as attributes in the step, as with `input_file_path: str` below

### b. Next, write the `run` method

This method takes the ContinueSDK as a parameter, giving you all the tools you need to write your recipe/steps (if it's missing something, let us know, we'll add it!). You can write any code inside the run method; this is what will happen when your recipe is run, line for line. As you're writing the run method, you want to consider how to break it up into sub-steps; each step will be displayed as a cell in the GUI, so this makes a difference to the end user. To break something off into a sub-step, simply make a new subclass of Step just like this one, with parameters and a run method, and call it inside of the parent step using `await sdk.run_step(MySubStep(<parameters>))`. To understand all of the other things you can do inside of a step with the `ContinueSDK`, see its documentation page.

### c. Finally, every Step is displayed with a description of what it has done

If you'd like to override the default description of your steps, which is just the class name, then implement the `describe` method. You can:

- Return a static string
- Store state in a class attribute (prepend with a double underscore, which signifies (through Pydantic) that this is not a parameter for the Step, just internal state) during the run method, and then grab this in the describe method.
- Use state in conjunction with the `models` parameter of the describe method to autogenerate a description with a language model. For example, if you'd used an attribute called `__code_written` to store a string representing some code that was written, you could implement describe as `return models.summarize.complete(f"{self.\_\_code_written}\n\nSummarize the changes made in the above code.")`.

## 2. Compose steps together into a complete recipe

Creating a recipe is the same as creating a step, except that you may choose to break it up into intermediate steps

By convention, the name of every recipe ends with `Recipe`.

```python
class CreatePipelineRecipe(Step):

    async def run(self, sdk: ContinueSDK):
        await sdk.run_step(
            WaitForUserInputStep(prompt="What API do you want to load data from?") >>
            SetupPipelineStep() >>
            ValidatePipelineStep()
        )
```

## Additional considerations

### Using the SDK

You will want to use the SDK when you are opening directories, editing files, using models, etc. This will ensure that these actions are recorded as steps, so they are reviewable, reversible, and rerunnable.

### Allow for configurability

Steps can include optional parameters that allow users to configure them

```python
from continuedev import ContinueSDK

class CreatePytestsStep(Step):

    input_file_path: str
    output_file_prefix: str
    output_dir_path: str

    async def run(self, sdk: ContinueSDK):

        code = await sdk.ide.readFile(self.input_file_path)
        sdk.run_step(CreateDirStep(output_dir_path))
        sdk.run_step(WritePytestsRecipe(code, output_file_prefix, output_dir_path))
```

### Adjust for different OS

You might want to implement your steps, so that they can run on Linux, MacOS, and Windows.

```python
from continuedev import ContinueSDK
import platform

class SetUpVenvStep(Step):

    async def run(self, sdk: ContinueSDK):

        os = platform.system()

        if os == "Windows":
            await sdk.run("python -m venv env; .\\env\\Scripts\\activate")
        else:
            await sdk.run("python3 -m venv .env && source .env/bin/activate") # MacOS and Linux
```
