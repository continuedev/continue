from typing import List, Union, TypeVar, Generic

T = TypeVar('T')

class Address:
    pass

class Person:
    pass

class PersonWithGeneric(Generic[T]):
    pass


def get_address(person: Person) -> Address:
    pass

def get_group_address(people: Group[Person]) -> Group[Address]:
    pass

def log_person(person: Person) -> None:
    pass

def get_hardcoded_address() -> Address:
    pass

def log_person_or_address(value: Union[Person, Address]) -> Union[Person, Address]:
    pass

def log_person_and_address(person: Person, address: Address) -> None:
    pass

def get_address_generator(person: Person) -> Generator[Address, None, None]:
    yield


class Group:
    def log_person_and_address(self, person: Person, address: Address) -> None:
        pass

async def get_person(address: Address) -> Person:
    pass