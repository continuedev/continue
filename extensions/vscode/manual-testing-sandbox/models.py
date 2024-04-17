from typing import Optional
from pydantic import BaseModel


class Item(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    price: float
    quantity_in_stock: int = 0
