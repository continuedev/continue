
import pytest

from ..calculator import Calculator


@pytest.fixture
def calculator():
    return Calculator()


def test_add(calculator):
    assert calculator.add(2, 3) == 5
    assert calculator.add(10, -2) == 8
    assert calculator.add(0, 0) == 0


def test_sub(calculator):
    assert calculator.sub(2, 3) == -1
    assert calculator.sub(10, -2) == 12
    assert calculator.sub(0, 0) == 0


def test_mul(calculator):
    assert calculator.mul(2, 3) == 6
    assert calculator.mul(10, -2) == -20
    assert calculator.mul(0, 0) == 0


def test_div(calculator):
    assert calculator.div(2, 3) == 0.6666666666666666
    assert calculator.div(10, -2) == -5
    assert calculator.div(0, 1) == 0


def test_exp(calculator):
    assert calculator.exp(2, 3) == 8
    assert calculator.exp(10, -2) == 0.01
    assert calculator.exp(0, 0) == 1
