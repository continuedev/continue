from textwrap import dedent

from ...steps.input.nl_multiselect import NLMultiselectStep
from ...core.main import Step
from ...core.sdk import ContinueSDK
from ...steps.core.core import WaitForUserInputStep
from ...steps.main import MessageStep
from .steps import SetupPipelineStep


# https://github.com/dlt-hub/dlt-deploy-template/blob/master/airflow-composer/dag_template.py
# https://www.notion.so/dlthub/Deploy-a-pipeline-with-Airflow-245fd1058652479494307ead0b5565f3
# 1. What verified pipeline do you want to deploy with Airflow?
# 2. Set up selected verified pipeline
# 3. Deploy selected verified pipeline with Airflow
# 4. Set up Airflow locally?

class DeployPipelineAirflowRecipe(Step):
    hide: bool = True

    async def run(self, sdk: ContinueSDK):
        text_observation = await sdk.run_step(
            MessageStep(name="Deploying a pipeline to Airflow", message=dedent("""\
                This recipe will show you how to deploy a pipeline to Airflow. With the help of Continue, you will:
                - Select a dlt-verified pipeline
                - Setup the pipeline
                - Deploy it to Airflow
                - Optionally, setup Airflow locally""")) >>
            NLMultiselectStep(
                prompt=dedent("""\
                    Which verified pipeline do you want to deploy with Airflow? The options are:
                    - Asana
                    - Chess.com
                    - GitHub
                    - Google Analytics
                    - Google Sheets
                    - HubSpot
                    - Matomo
                    - Pipedrive
                    - Shopify
                    - Strapi
                    - Zendesk"""),
                options=[
                    "asana_dlt", "chess", "github", "google_analytics", "google_sheets", "hubspot", "matomo", "pipedrive", "shopify_dlt", "strapi", "zendesk"
                ])
        )
        await sdk.run_step(
            SetupPipelineStep(source_name=text_observation.text) >>
        )
