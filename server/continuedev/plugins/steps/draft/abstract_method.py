from ....core.main import Step
from ....core.sdk import ContinueSDK


class ImplementAbstractMethodStep(Step):
    name: str = "Implement abstract method for all subclasses"
    method_name: str
    class_name: str

    async def run(self, sdk: ContinueSDK):
        if sdk.lsp is None:
            self.description = "Language Server Protocol is not enabled"
            return

        implementations = await sdk.lsp.go_to_implementations(self.class_name)

        for implementation in implementations:
            await sdk.edit_file(
                range_in_files=[implementation.range_in_file],
                prompt=f"Implement method `{self.method_name}` for this subclass of `{self.class_name}`",
            )
