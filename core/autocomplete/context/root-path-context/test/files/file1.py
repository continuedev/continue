from base_module import BaseClass
from interfaces_module import FirstInterface, SecondInterface

def get_address(person):
    return person.address

class Group(BaseClass, FirstInterface, SecondInterface):
    def __init__(self, people):
        super().__init__()
        self.people = people

    def get_person_address(self, person):
        return get_address(person)
