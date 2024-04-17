from typing import List
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uuid

app = FastAPI()


class Item(BaseModel):
    id: str = None
    name: str
    description: str = None
    price: float
    quantity_in_stock: int = 0


# Mock database
items = {}


@app.post("/items/", response_model=Item)
def create_item(item: Item):
    item.id = uuid.uuid4().hex  # generate a unique id for the item
    items[item.id] = item.dict()
    return item


@app.get("/items/", response_model=List[Item])
def read_items():
    return list(items.values())


@app.get("/items/{item_id}", response_model=Item)
def read_item(item_id: str):
    item = items.get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return Item(**item)


@app.put("/items/{item_id}", response_model=Item)
def update_item(item_id: str, updated_item: Item):
    if item_id not in items:
        raise HTTPException(status_code=404, detail="Item not found")

    # Update the existing item with new data from the request body
    updated_item.id = item_id  # Make sure the id remains unchanged
    items[item_id] = updated_item.dict()
    return updated_item


@app.delete("/items/{item_id}")
def delete_item(item_id: str):
    if item_id not in items:
        raise HTTPException(status_code=404, detail="Item not found")

    del items[item_id]  # Delete the item from the database
