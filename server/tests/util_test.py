import os
import re

from continuedev.libs.util.errors import format_exc


class TestUtils:
    def test_get_random_string(self):
        current_file_path = os.path.abspath(__file__)
        try:
            raise Exception("test")
        except Exception as e:
            assert re.match(
                rf'Traceback \(most recent call last\):\n\n  File "{re.escape(current_file_path)}", line \d+, in test_get_random_string\n    raise Exception\("test"\)\n\nException: test\n',
                format_exc(e),
            )
