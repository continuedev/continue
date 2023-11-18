from continuedev.libs.util.errors import format_exc


class TestUtils:
    def test_get_random_string(self):
        try:
            raise Exception("test")
        except Exception as e:
            assert format_exc(e) == ""
