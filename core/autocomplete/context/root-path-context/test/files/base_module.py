# File: base_module.py

class BaseClass:
    def __init__(self):
        print("BaseClass initialized")

class Collection:
    def __init__(self):
        print("Collection initialized")

class Address:
    def __init__(self, street: str, city: str, zip_code: str):
        self.street = street
        self.city = city
        self.zip_code = zip_code

    def __str__(self):
        return f"{self.street}, {self.city}, {self.zip_code}"

class Person:
    def __init__(self, name: str, address: Address):
        self.name = name
        self.address = address

    def __str__(self):
        return f"{self.name} lives at {self.address}"
