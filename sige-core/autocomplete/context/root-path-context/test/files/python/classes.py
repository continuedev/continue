class Group(BaseClass, Person):
    pass

class Group(metaclass=MetaGroup):
    pass

class Group(BaseClass[Address], Gathering[Person]):
    pass

class Group(List[Address], Person[str]):
    pass