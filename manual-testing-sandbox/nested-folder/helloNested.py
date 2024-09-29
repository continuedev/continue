from typing import List

Vector = List[float]


def main(a: Vector):
    print("Hello Nested!")


class MyClass:
    def test(a: Vector) -> Vector:
        return a


raise Exception("This is an error")
