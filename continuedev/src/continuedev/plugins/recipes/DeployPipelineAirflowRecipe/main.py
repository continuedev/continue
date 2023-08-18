from textwrap import dedent

from ....core.main import Step
from ....core.sdk import ContinueSDK
from ....plugins.steps.core.core import MessageStep
from ....plugins.steps.input.nl_multiselect import NLMultiselectStep
from .steps import DeployAirflowStep, RunPipelineStep, SetupPipelineStep

# https://github.com/dlt-hub/dlt-deploy-template/blob/master/airflow-composer/dag_template.py
# https://www.notion.so/dlthub/Deploy-a-pipeline-with-Airflow-245fd1058652479494307ead0b5565f3
# 1. What verified pipeline do you want to deploy with Airflow?
# 2. Set up selected verified pipeline
# 3. Deploy selected verified pipeline with Airflow
# 4. Set up Airflow locally?


class DeployPipelineAirflowRecipe(Step):
    hide: bool = True

    async def run(self, sdk: ContinueSDK):
        source_name = await sdk.run_step(
            MessageStep(
                name="Deploying a pipeline to Airflow",
                message=dedent(
                    """\
                This recipe will show you how to deploy a pipeline to Airflow. With the help of Continue, you will:
                - Select a dlt-verified pipeline
                - Setup the pipeline
                - Deploy it to Airflow
                - Optionally, setup Airflow locally"""
                ),
            )
            >> NLMultiselectStep(
                prompt=dedent(
                    """\
                    Which verified pipeline do you want to deploy with Airflow? The options are:
                    - Asana
                    - Chess.com
                    - Facebook Ads
                    - GitHub
                    - Google Analytics
                    - Google Sheets
                    - HubSpot
                    - Jira
                    - Matomo
                    - Mux
                    - Notion
                    - Pipedrive
                    - Pokemon
                    - Salesforce
                    - Shopify
                    - Strapi
                    - Stripe
                    - SQL Database
                    - Workable
                    - Zendesk"""
                ),
                options=[
                    "asana_dlt",
                    "chess",
                    "github",
                    "google_analytics",
                    "google_sheets",
                    "hubspot",
                    "matomo",
                    "pipedrive",
                    "shopify_dlt",
                    "strapi",
                    "zendesk",
                    "facebook_ads",
                    "jira",
                    "mux",
                    "notion",
                    "pokemon",
                    "salesforce",
                    "stripe_analytics",
                    "sql_database",
                    "workable",
                ],
            )
        )
        await sdk.run_step(
            SetupPipelineStep(source_name=source_name)
            >> RunPipelineStep(source_name=source_name)
            >> DeployAirflowStep(source_name=source_name)
        )
