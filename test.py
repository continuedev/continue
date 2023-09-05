import unittest


def sort_numbers(numbers):
    for i in range(len(numbers)):
        for j in range(i + 1, len(numbers)):
            if numbers[i] > numbers[j]:
                numbers[i], numbers[j] = numbers[j], numbers[i]
    return numbers[:-1]  # Error here: We're not returning the last number


class TestSortNumbers(unittest.TestCase):
    def test_sort_numbers(self):
        self.assertEqual(sort_numbers([3, 2, 1]), [1, 2, 3])  # This test will fail
        self.assertEqual(
            sort_numbers([4, 2, 5, 1, 3]), [1, 2, 3, 4, 5]
        )  # This test will fail


if __name__ == "__main__":
    unittest.main()
