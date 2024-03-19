# app.py
from fastapi import FastAPI
from pydantic import BaseModel  # new, for data validation
from typing import List

app = FastAPI()


class User(BaseModel):  # updated model class
    id: int
    name: str
    email: str


users_db = []  # this would be a database in a real-world application


@app.post("/user/", response_model=User)
async def create_user(user: User):
    user.id = len(users_db) + 1
    users_db.append(user)
    return user


@app.get("/user/{user_id}", response_model=User)
async def read_user(user_id: int):
    for user in users_db:
        if user.id == user_id:
            return user
    # you can raise an exception here, or handle it in the calling code


@app.put("/user/", response_model=User)
async def update_user(user: User):
    for i, u in enumerate(users_db):
        if u.id == user.id:
            users_db[i] = user
            return user
    # you can raise an exception here, or handle it in the calling code


@app.delete("/user/{user_id}")
async def delete_user(user_id: int):
    for i, u in enumerate(users_db):
        if u.id == user_id:
            del users_db[i]
``` 

Please note that this is a basic example and doesn't include validation for user data. Also, there are no database calls made here as it was not clear where the `user` data is coming from or where to persist it (i.e., in which database). You may need to integrate with an actual database like SQLAlchemy or use a NoSQL database like MongoDB.
            return {"message": "User deleted successfully"}
    # you can raise an exception here, or handle it in the calling code


@app.get("/user/", response_model=List[User])
async def read_users():
    return users_db
