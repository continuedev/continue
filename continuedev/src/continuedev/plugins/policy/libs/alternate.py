from plugins import policy
from ....libs.observation import Observation
from ....libs.steps import Step
from ....libs.core import History


class AlternatingPolicy:
    """A Policy that alternates between two steps."""

    def __init__(self, first: Step, second: Step):
        self.first = first
        self.second = second
        self.last_was_first = False

    @policy.hookimpl
    def next(self, history: History) -> Step:
        if self.last_was_first:
            self.last_was_first = False
            return self.second
        else:
            self.last_was_first = True
            return self.first
