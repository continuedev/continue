from base_module import BaseClass, Collection, Person, Address
from typing import List

def get_address(person: Person) -> Address:
    return person.address

class Group(BaseClass, Collection):
    def __init__(self, people: List[Person]) -> None:
        super().__init__()
        self.people = people

    def get_person_address(self, person: Person) -> Address:
        return get_address(person)
