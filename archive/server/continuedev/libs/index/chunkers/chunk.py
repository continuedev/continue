from chromadb.types import Metadata

from ....models.main import ContinueBaseModel


class ChunkWithoutID(ContinueBaseModel):
    content: str
    start_line: int
    end_line: int
    other_metadata: Metadata = {}

    def with_id(self, digest: str, index: int, filepath: str):
        return Chunk(
            content=self.content,
            start_line=self.start_line,
            end_line=self.end_line,
            other_metadata=self.other_metadata,
            digest=digest,
            index=index,
            filepath=filepath,
        )


class Chunk(ChunkWithoutID):
    digest: str
    index: int  # The index of the chunk in the document
    filepath: str

    @property
    def id(self):
        return f"{self.digest}::{self.index}"

    @property
    def metadata(self):
        # Nested dicts not allowed by chromadb
        other_metadata = self.other_metadata.copy()
        d = self.dict()
        del d["content"]
        del d["other_metadata"]
        return {
            **other_metadata,
            **d,
        }
