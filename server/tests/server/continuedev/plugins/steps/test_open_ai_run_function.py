import asyncio
import unittest
from unittest import TestCase
from unittest.mock import patch, MagicMock, AsyncMock
from continuedev.plugins.steps.openai_run_func import OpenAIRunFunction

class TestOpenAIRunFunction(TestCase):
    def setUp(self):
        self.open_ai_run_function = OpenAIRunFunction(
            api_key = "mock_api_key",
            thread_id = "mock_thread_id",
            run_id = "mock_run_id",
            user_input = "/mock_user_input",
            name = "mock_name",
        )
        
    @patch('continuedev.plugins.steps.openai_run_func.get_file_contents', new_callable=AsyncMock)
    @patch('continuedev.plugins.steps.openai_run_func.get_all_filepaths', new_callable=AsyncMock)
    def test_get_project_file(self, get_all_filepaths_mock, get_file_contents_mock):
        # Here we simulate that get_all_filepaths method returns file paths including 'README.md'
        get_all_filepaths_mock.return_value = (['/path/to/workspace/README.md','another','asdf'], None)

        # And simulate get_file_contents returning 'Mocked file content.'
        get_file_contents_mock.return_value = 'Mocked file content.'

        # Mock SDK object
        sdk_mock = MagicMock()
        sdk_mock.ide.workspace_directory = '/path/to/workspace'

       
        # Call the async method under test
        file_content = asyncio.run(self.open_ai_run_function.get_project_file(sdk_mock, 'README'))

        # Assert file_content matches the mocked content and other appropriate assertions
        self.assertEqual(file_content, 'Mocked file content.')
        get_file_contents_mock.assert_called_once_with('/path/to/workspace/README.md', sdk_mock.ide)

if __name__ == '__main__':
    unittest.main()