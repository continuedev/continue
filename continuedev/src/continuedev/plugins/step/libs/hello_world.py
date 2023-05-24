from ....plugins import step
from ....libs.steps import ContinueSDK


class HelloWorldStep:
    """A Step that prints "Hello World!"."""
    @step.hookimpl
    def run(sdk: ContinueSDK):
        print("Hello World!")
