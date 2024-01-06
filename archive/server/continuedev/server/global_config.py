from typing import Optional
from pydantic import BaseModel


class GlobalConfig(BaseModel):
    meilisearch_url: Optional[str] = None
    disable_meilisearch: bool = False


global_config = GlobalConfig()
