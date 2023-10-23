from typing import Optional
from pydantic import BaseModel


class GlobalConfig(BaseModel):
    meilisearch_url: Optional[str] = None

global_config = GlobalConfig()