from ....core.main import Step
from ....core.sdk import ContinueSDK
from ....core.steps import EditFileStep


class EditReduxStateStep(Step):
    description: str  # e.g. "I want to load data from the weatherapi.com API"

    async def run(self, sdk: ContinueSDK):
        # Find the right file to edit

        # RootStore
        store_filename = ""
        sdk.run_step(
            EditFileStep(
                filename=store_filename,
                prompt=f"Edit the root store to add a new slice for {self.description}",
            )
        )
        store_file_contents = await sdk.ide.readFile(store_filename)

        # Selector
        selector_filename = ""
        sdk.run_step(
            EditFileStep(
                filepath=selector_filename,
                prompt=f"Edit the selector to add a new property for {self.description}. The store looks like this: {store_file_contents}",
            )
        )

        # Reducer
        reducer_filename = ""
        sdk.run_step(
            EditFileStep(
                filepath=reducer_filename,
                prompt=f"Edit the reducer to add a new property for {self.description}. The store looks like this: {store_file_contents}",
            )
        )
        """
        Starts with implementing selector
        1. RootStore
        2. Selector
        3. Reducer or entire slice

        Need to first determine whether this is an:
        1. edit
        2. add new reducer and property in existing slice
        3. add whole new slice
        4. build redux from scratch
        """
