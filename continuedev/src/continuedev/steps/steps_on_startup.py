from ..core.main import ContinueSDK, Models, Step
from .main import UserInputStep
from ..recipes.CreatePipelineRecipe.main import CreatePipelineRecipe
from ..recipes.AddTransformRecipe.main import AddTransformRecipe

step_name_to_step_class = {
    "UserInputStep": UserInputStep,
    "CreatePipelineRecipe": CreatePipelineRecipe,
    "AddTransformRecipe": AddTransformRecipe
}


class StepsOnStartupStep(Step):
    hide: bool = True

    async def describe(self, models: Models):
        return "Running steps on startup"

    async def run(self, sdk: ContinueSDK):
        steps_descriptions = (await sdk.get_config()).steps_on_startup

        for step_name, step_params in steps_descriptions.items():
            try:
                step = step_name_to_step_class[step_name](**step_params)
            except:
                print(
                    f"Incorrect parameters for step {step_name}. Parameters provided were: {step_params}")
                continue
            await sdk.run_step(step)
