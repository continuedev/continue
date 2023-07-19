
from abc import ABC, abstractmethod, abstractproperty
from ast import List
from pydantic import BaseModel

from ..libs.util.count_tokens import compile_chat_messages


class ContextItemDescription(BaseModel):
    """
    A ContextItemDescription is a description of a ContextItem that is displayed to the user when they type '@'.

    The id can be used to retrieve the ContextItem from the ContextManager.
    """
    name: str
    description: str
    id:  str


class ContextItem(BaseModel):
    """
    A ContextItem is a single item that is stored in the ContextManager.
    """
    description: ContextItemDescription
    content: str


class ContextManager(ABC):
    """
    The context manager is responsible for storing the context to be passed to the LLM, including
    - ContextItems (highlighted code, GitHub Issues, etc.)
    - ChatMessages in the history
    - System Message
    - Functions

    It is responsible for compiling all of this information into a single prompt without exceeding the token limit.
    """

    def compile_chat_messages(self, max_tokens: int) -> List[Dict]:
        """
        Compiles the chat prompt into a single string.
        """
        return compile_chat_messages(self.model, self.chat_history, max_tokens, self.prompt, self.functions, self.system_message)


"""
Should define "ArgsTransformer" and "PromptTransformer" classes for the different LLMs. A standard way for them to ingest the
same format of prompts so you don't have to redo all of this logic.
"""


class ContextProvider(ABC):
    """
    The ContextProvider class is a plugin that lets you provide new information to the LLM by typing '@'.
    When you type '@', the context provider will be asked to populate a list of options.
    These options will be updated on each keystroke.
    When you hit enter on an option, the context provider will add that item to the autopilot's list of context (which is all stored in the ContextManager object).
    """

    title: str

    @abstractmethod
    async def load(self):
        """
        Loads the ContextProvider, possibly reading persisted data from disk. This will be called on startup.
        """

    @abstractmethod
    async def save(self):
        """
        Saves the ContextProvider, possibly writing persisted data to disk. This will be called upon cache refresh.
        """

    @abstractmethod
    async def refresh_cache(self):
        """
        Refreshes the cache of items. This will be called on startup and periodically.
        """

    @abstractmethod
    async def get_item_descriptions(self, query: str) -> List[ContextItemDescription]:
        """
        Returns a list of options that should be displayed to the user.
        """

    @abstractmethod
    async def get_item(self, id: str) -> ContextItem:
        """
        Returns the ContextItem with the given id. This allows you not to have to load all of the information until an item is selected.
        """

    @abstractmethod
    async def should_refresh(self) -> bool:
        """
        Returns whether the ContextProvider should be refreshed.

        For example, embeddings might need to be recalculated after commits,
        or GitHub issues might need to be refreshed after a new issue is created.

        This method will be called every startup? Every once in a while? Every hour?
        User defined? Maybe just have a schedule instead of this method.
        """


class GitHubIssuesContextProvider(ContextProvider):
    """
    The GitHubIssuesContextProvider is a ContextProvider that allows you to search GitHub issues in a repo.
    """

    title = "issues"

    def __init__(self, repo: str):
        self.repo = repo

    async def get_item_descriptions(self, query: str) -> List[ContextItemDescription]:
        pass

    async def get_item(self, id: str) -> ContextItem:
        pass
