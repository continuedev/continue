from pydantic import BaseModel


class User(BaseModel):
    id: int
    name = "John Doe"
    sign_up_ts = None
