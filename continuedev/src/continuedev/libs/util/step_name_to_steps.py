from typing import Dict

from ...core.main import Step
from ...steps.core.core import UserInputStep
from ...recipes.CreatePipelineRecipe.main import CreatePipelineRecipe
from ...recipes.DDtoBQRecipe.main import DDtoBQRecipe
from ...recipes.DeployPipelineAirflowRecipe.main import DeployPipelineAirflowRecipe
from ...recipes.DDtoBQRecipe.main import DDtoBQRecipe
from ...recipes.AddTransformRecipe.main import AddTransformRecipe

step_name_to_step_class = {
    "UserInputStep": UserInputStep,
    "CreatePipelineRecipe": CreatePipelineRecipe,
    "DDtoBQRecipe": DDtoBQRecipe,
    "DeployPipelineAirflowRecipe": DeployPipelineAirflowRecipe,
    "AddTransformRecipe": AddTransformRecipe,
    "DDtoBQRecipe": DDtoBQRecipe
}


def get_step_from_name(step_name: str, params: Dict) -> Step:
    try:
        return step_name_to_step_class[step_name](**params)
    except:
        print(
            f"Incorrect parameters for step {step_name}. Parameters provided were: {params}")
        raise
