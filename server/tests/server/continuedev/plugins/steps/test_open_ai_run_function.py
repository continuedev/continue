import unittest
from unittest import mock
from ...server.continuedev.plugins.steps.openai_run_func import OpenAIRunFunction  

class TestOpenAIRunFunction(unittest.TestCase):
    def setUp(self):
        self.file_list = [
            "README.md",
            "CONTRIBUTING.md",
            "index.html",
            "main.py",
            "utils/helpers.py"
        ]
        self.open_ai_run_function = OpenAIRunFunction(self.file_list)

    @mock.patch('your_module.OpenAIRunFunction.fetch_file_content')  # Patch the fetch_file_content method
    def test_get_project_file_exact_match(self, mock_fetch_file_content):
        mock_fetch_file_content.return_value = "Exact file content"
        
        expected_content = "Exact file content"
        actual_content = self.open_ai_run_function.get_project_file("README.md")
        
        # Verify that the mock was called with the correct filename
        mock_fetch_file_content.assert_called_with("README.md")

        # Verify the returned file content matches the mock return value
        self.assertEqual(actual_content, expected_content)

    @mock.patch('your_module.OpenAIRunFunction.fetch_file_content')  # Patch the fetch_file_content method
    def test_get_project_file_fuzzy_match(self, mock_fetch_file_content):
        mock_fetch_file_content.return_value = "Fuzzy file content"
        
        expected_content = "Fuzzy file content"
        actual_content = self.open_ai_run_function.get_project_file("REDEME.md")  # Intentionally misspelled
        
        # Verify that the mock was called with the closely matched filename
        mock_fetch_file_content.assert_called_with("README.md")
        
        # Verify the returned file content matches the mock return value
        self.assertEqual(actual_content, expected_content)

    @mock.patch('your_module.OpenAIRunFunction.fetch_file_content')
    def test_get_project_file_no_match(self, mock_fetch_file_content):
        # Since we expect no match, the fetch_file_content method should not be called
        expected_content = "No closely matched file found for 'NOT_A_FILE.md'."
        actual_content = self.open_ai_run_function.get_project_file("NOT_A_FILE.md")  # Nonexistent file
        
        # Verify that the mock was not called because there should be no match
        mock_fetch_file_content.assert_not_called()
        
        # Verify the returned message about not finding a closely matched file
        self.assertEqual(actual_content, expected_content)

if __name__ == '__main__':
    unittest.main()
