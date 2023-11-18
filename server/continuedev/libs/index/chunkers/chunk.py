from chromadb.types import Metadata

from ....models.main import ContinueBaseModel


class ChunkWithoutID(ContinueBaseModel):
    content: str
    start_line: int
    end_line: int
    other_metadata: Metadata = {}

    def with_id(self, document_id: str, index: int):
        return Chunk(
            content=self.content,
            start_line=self.start_line,
            end_line=self.end_line,
            other_metadata=self.other_metadata,
            document_id=document_id,
            index=index,
        )


class Chunk(ChunkWithoutID):
    document_id: str
    index: int  # The index of the chunk in the document

    @property
    def id(self):
        return f"{self.document_id}::{self.index}"

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
