"""
This file contains mechanisms for logging development data to files, SQL databases, and other formats.
"""


import os
from dotenv import load_dotenv
from typing import Dict, Generic, List, Literal, Optional, Type, TypeVar, Union
import dlt
from pydantic import BaseModel, validator
import requests


class BaseDevDataModel(BaseModel):
    """
    A base class for all dev data models.
    """
    org_id: str
    dev_id: str


class DevDataEntry(BaseModel):
    table_name: str
    data: Union[List[BaseDevDataModel], BaseDevDataModel]

    def __init__(self, **data):
        if self.__class__ is DevDataEntry:
            raise TypeError('DevDataEntry cannot be directly instantiated')
        super().__init__(**data)

    @validator('data', pre=True)
    def data_validator(cls, v):
        if isinstance(v, list):
            return v
        return [v]


T = TypeVar("T", bound=BaseDevDataModel)


class Pipeline:

    def __init__(self, name: str, destination: str, dataset_name: str):
        self.pipeline = dlt.pipeline(
            pipeline_name=name,
            destination=destination,
            dataset_name=dataset_name
        )

    def run(self, data: List[BaseDevDataModel], table_name: str):
        self.pipeline.run(list(map(lambda x: x.dict(), data)),
                          table_name=table_name, credentials={

        })


load_dotenv()


class DevDataLoader(BaseModel):
    destination: Literal["json", "bigquery", "duckdb"]
    credentials: Optional[BaseModel] = None


class BigQueryCredentials(BaseModel):
    project_id: str = None
    private_key: str = None
    client_email: str = None

    @validator('private_key', pre=True)
    def private_key_validator(cls, v):
        if v is None:
            return os.getenv("GOOGLE_PRIVATE_KEY")
