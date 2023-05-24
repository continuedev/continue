from typing import List, Tuple
import pluggy
from ...libs.policy import Policy, Step

hookspec = pluggy.HookspecMarker("continue.policy")

class PolicyPlugin(Policy):
    @hookspec
    def next(self) -> Step:
        """Get the next step to run"""