# Create a Recipe

## 1. Create a step

### Using the SDK

You will want to use the SDK when you are opening directories, editing files, using models, etc.

This will ensure that these actions are recorded as steps, so they are reviewable, reversable, and rerunnable.

### Allow for configurability

Steps can include optional parameters that allow users to configure them

```python
from continueos import ContinueSDK

class CreatePytestsStep(Step):

    input_file_path: str
    output_file_prefix: str
    output_dir_path: str

    async def run(self, sdk: ContinueSDK):

        code = await sdk.ide.readFile(self.input_file_path)
        sdk.run_step(CreateDirStep(output_dir_path))
        sdk.run_step(WritePytestsStep(code, output_file_prefix, output_dir_path))
```

### Adjust for different OS

You might want to implement your steps, so that they can run on Linux, MacOS, and Windows.

```python
from continueos import ContinueSDK
import platform

class SetUpVenvStep(Step):

    async def run(self, sdk: ContinueSDK):

        os = platform.system()

        if os == "Windows":
            await sdk.run("python -m venv env; .\\env\\Scripts\\activate")
        else:
            await sdk.run("python3 -m venv env && source env/bin/activate") # MacOS and Linux
```

## 2. Compose steps together

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