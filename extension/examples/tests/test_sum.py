import pytest
# print(__name__)
# from ..sum import sum as real_sum

def sum(a, b):
    return a + b

def test_sum():
    assert sum(1, 2) == 3

def test_abc():
    assert True